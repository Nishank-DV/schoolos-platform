import { Router } from "express";
import { z } from "zod";
import { paginationSchema } from "shared-utils";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { auditLog } from "../middleware/audit.js";

const idParam = z.object({ id: z.string().min(1) });
const studentIdParam = z.object({ studentId: z.string().min(1) });
const examIdParam = z.object({ examId: z.string().min(1) });
const classIdParam = z.object({ classId: z.string().min(1) });
const reportCardParams = z.object({ studentId: z.string().min(1), examId: z.string().min(1) });

const examListQuery = paginationSchema.extend({
  schoolId: z.string().cuid().optional(),
  classId: z.string().min(1).optional(),
  academicYearId: z.string().min(1).optional(),
  status: z.enum(["draft", "published", "completed"]).optional(),
});

const createExamSchema = z.object({
  schoolId: z.string().min(1).optional(),
  classId: z.string().min(1),
  academicYearId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["draft", "published", "completed"]).optional(),
});

const updateExamSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["draft", "published", "completed"]).optional(),
});

const examSubjectSchema = z.object({
  subjectId: z.string().min(1),
  maxMarks: z.number().min(1),
  passMarks: z.number().min(0),
}).superRefine((value, ctx) => {
  if (value.passMarks > value.maxMarks) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "passMarks cannot be greater than maxMarks" });
  }
});

const updateExamSubjectSchema = z.object({
  maxMarks: z.number().min(1).optional(),
  passMarks: z.number().min(0).optional(),
}).superRefine((value, ctx) => {
  if (value.maxMarks !== undefined && value.passMarks !== undefined && value.passMarks > value.maxMarks) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "passMarks cannot be greater than maxMarks" });
  }
});

const markItemSchema = z.object({
  examSubjectId: z.string().min(1),
  studentId: z.string().min(1),
  marksObtained: z.number().min(0),
  remarks: z.string().optional().nullable(),
});

const createMarksSchema = z
  .object({
    examSubjectId: z.string().min(1).optional(),
    studentId: z.string().min(1).optional(),
    marksObtained: z.number().min(0).optional(),
    remarks: z.string().optional().nullable(),
    items: z.array(markItemSchema).min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const hasSingle = value.examSubjectId && value.studentId && value.marksObtained !== undefined;
    if (!value.items?.length && !hasSingle) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide either items[] or single mark payload" });
    }
  });

const updateMarkSchema = z.object({
  marksObtained: z.number().min(0).optional(),
  remarks: z.string().optional().nullable(),
});

const classResultsQuery = z.object({
  schoolId: z.string().min(1).optional(),
  academicYearId: z.string().min(1).optional(),
  examId: z.string().min(1).optional(),
});

const studentResultsQuery = z.object({
  schoolId: z.string().min(1).optional(),
});

const examMarksQuery = z.object({
  schoolId: z.string().min(1).optional(),
});

export const examsRouter = Router();
examsRouter.use(authMiddleware);

function getSchoolId(req: import("express").Request, input?: string) {
  if (req.user!.role === "superadmin") return input ?? (req.query.schoolId as string | undefined);
  return req.user!.schoolId;
}

function gradeFromPercentage(percent: number): string {
  if (percent >= 90) return "A+";
  if (percent >= 80) return "A";
  if (percent >= 70) return "B";
  if (percent >= 60) return "C";
  if (percent >= 50) return "D";
  return "F";
}

function gpaFromPercentage(percent: number): number {
  if (percent >= 90) return 4.0;
  if (percent >= 80) return 3.6;
  if (percent >= 70) return 3.2;
  if (percent >= 60) return 2.8;
  if (percent >= 50) return 2.4;
  return 0.0;
}

function gradeFromMarks(marks: number, maxMarks: number): string {
  if (maxMarks <= 0) return "F";
  return gradeFromPercentage((marks / maxMarks) * 100);
}

async function recalculateStudentResult(schoolId: string, examId: string, studentId: string) {
  const examSubjects = await prisma.examSubject.findMany({
    where: { examId },
    select: {
      id: true,
      maxMarks: true,
      studentMarks: {
        where: { studentId },
        select: { marksObtained: true },
        take: 1,
      },
    },
  });

  const totalPossible = examSubjects.reduce((sum, item) => sum + Number(item.maxMarks), 0);
  const totalObtained = examSubjects.reduce((sum, item) => sum + Number(item.studentMarks[0]?.marksObtained ?? 0), 0);
  const percentage = totalPossible > 0 ? Number(((totalObtained / totalPossible) * 100).toFixed(2)) : 0;
  const gpa = Number(gpaFromPercentage(percentage).toFixed(2));

  await prisma.examResult.upsert({
    where: { examId_studentId: { examId, studentId } },
    update: {
      totalMarks: totalObtained,
      percentage,
      gpa,
    },
    create: {
      schoolId,
      examId,
      studentId,
      totalMarks: totalObtained,
      percentage,
      gpa,
    },
  });
}

async function recalculateExamRanks(examId: string, schoolId: string) {
  const results = await prisma.examResult.findMany({
    where: { examId, schoolId },
    orderBy: [{ percentage: "desc" }, { totalMarks: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  await prisma.$transaction(
    results.map((result, index) =>
      prisma.examResult.update({ where: { id: result.id }, data: { rank: index + 1 } })
    )
  );
}

async function ensureStudentAccess(req: import("express").Request, studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      schoolId: true,
      parentId: true,
      class: { select: { teacherId: true } },
    },
  });
  if (!student) return { ok: false as const, error: "Student not found", status: 404 };

  if (req.user!.role === "student" && req.user!.studentId !== student.id) {
    return { ok: false as const, error: "Forbidden", status: 403 };
  }

  if (req.user!.role === "parent" && req.user!.parentId !== student.parentId) {
    return { ok: false as const, error: "Forbidden", status: 403 };
  }

  if (req.user!.role === "teacher") {
    if (!req.user!.teacherId || req.user!.schoolId !== student.schoolId || student.class?.teacherId !== req.user!.teacherId) {
      return { ok: false as const, error: "Forbidden", status: 403 };
    }
  }

  if (req.user!.role === "school_admin" && req.user!.schoolId !== student.schoolId) {
    return { ok: false as const, error: "Forbidden", status: 403 };
  }

  const schoolId = req.user!.role === "superadmin" ? ((req.query.schoolId as string | undefined) ?? student.schoolId) : req.user!.schoolId;
  if (!schoolId || schoolId !== student.schoolId) {
    return { ok: false as const, error: "School access denied", status: 403 };
  }

  return { ok: true as const, student, schoolId };
}

// GET /api/exams
examsRouter.get(
  "/exams",
  requireRoles("superadmin", "school_admin", "teacher"),
  validateQuery(examListQuery),
  async (req, res) => {
    const { page, pageSize, classId, academicYearId, status } = req.query as unknown as {
      page: number;
      pageSize: number;
      classId?: string;
      academicYearId?: string;
      status?: string;
    };

    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const where: Record<string, unknown> = { schoolId };
    if (req.user!.role === "teacher") {
      if (!req.user!.teacherId) return res.status(403).json({ success: false, error: "Teacher context missing" });
      where.class = { teacherId: req.user!.teacherId };
    }
    if (classId) where.classId = classId;
    if (academicYearId) where.academicYearId = academicYearId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        include: {
          class: { select: { id: true, name: true, grade: true } },
          academicYear: { select: { id: true, name: true, isActive: true } },
          _count: { select: { examSubjects: true, results: true } },
        },
      }),
      prisma.exam.count({ where }),
    ]);

    res.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  }
);

// POST /api/exams
examsRouter.post(
  "/exams",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("exam.create", "Exam", (req) => req.body?.name ?? null),
  validateBody(createExamSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const [classEntity, year] = await Promise.all([
      prisma.class.findFirst({ where: { id: req.body.classId, schoolId } }),
      prisma.academicYear.findFirst({ where: { id: req.body.academicYearId, schoolId } }),
    ]);

    if (!classEntity) return res.status(400).json({ success: false, error: "Class not found for school" });
    if (!year) return res.status(400).json({ success: false, error: "Academic year not found for school" });
    if (req.user!.role === "teacher" && classEntity.teacherId !== req.user!.teacherId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const exam = await prisma.exam.create({
      data: {
        schoolId,
        classId: req.body.classId,
        academicYearId: req.body.academicYearId,
        name: req.body.name,
        description: req.body.description,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        status: req.body.status ?? "draft",
      },
      include: {
        class: { select: { id: true, name: true, grade: true } },
        academicYear: { select: { id: true, name: true, isActive: true } },
      },
    });

    res.status(201).json({ success: true, data: exam });
  }
);

// GET /api/exams/:id
examsRouter.get(
  "/exams/:id",
  requireRoles("superadmin", "school_admin", "teacher"),
  validateParams(idParam),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const exam = await prisma.exam.findFirst({
      where: {
        id: req.params.id,
        schoolId,
        ...(req.user!.role === "teacher" ? { class: { teacherId: req.user!.teacherId } } : {}),
      },
      include: {
        class: { select: { id: true, name: true, grade: true } },
        academicYear: { select: { id: true, name: true, isActive: true } },
        examSubjects: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            _count: { select: { studentMarks: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        results: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
          },
          orderBy: [{ rank: "asc" }, { percentage: "desc" }],
        },
      },
    });

    if (!exam) return res.status(404).json({ success: false, error: "Exam not found" });
    res.json({ success: true, data: exam });
  }
);

// PATCH /api/exams/:id
examsRouter.patch(
  "/exams/:id",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("exam.update", "Exam", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updateExamSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.exam.findFirst({
      where: {
        id: req.params.id,
        schoolId,
        ...(req.user!.role === "teacher" ? { class: { teacherId: req.user!.teacherId } } : {}),
      },
    });
    if (!existing) return res.status(404).json({ success: false, error: "Exam not found" });

    const data: Record<string, unknown> = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.startDate !== undefined) data.startDate = new Date(req.body.startDate);
    if (req.body.endDate !== undefined) data.endDate = new Date(req.body.endDate);
    if (req.body.status !== undefined) data.status = req.body.status;

    const exam = await prisma.exam.update({
      where: { id: req.params.id },
      data,
      include: {
        class: { select: { id: true, name: true, grade: true } },
        academicYear: { select: { id: true, name: true, isActive: true } },
      },
    });

    res.json({ success: true, data: exam });
  }
);

// DELETE /api/exams/:id
examsRouter.delete(
  "/exams/:id",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("exam.delete", "Exam", (req) => req.params.id),
  validateParams(idParam),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.exam.findFirst({
      where: {
        id: req.params.id,
        schoolId,
        ...(req.user!.role === "teacher" ? { class: { teacherId: req.user!.teacherId } } : {}),
      },
      include: {
        examSubjects: { include: { _count: { select: { studentMarks: true } } } },
        _count: { select: { results: true } },
      },
    });

    if (!existing) return res.status(404).json({ success: false, error: "Exam not found" });

    const hasMarks = existing.examSubjects.some((s) => s._count.studentMarks > 0);
    if (hasMarks || existing._count.results > 0) {
      return res.status(400).json({ success: false, error: "Cannot delete exam with marks/results" });
    }

    await prisma.exam.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  }
);

// POST /api/exams/:id/subjects
examsRouter.post(
  "/exams/:id/subjects",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("exam.subject.create", "ExamSubject", (req) => req.params.id),
  validateParams(idParam),
  validateBody(examSubjectSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const exam = await prisma.exam.findFirst({
      where: {
        id: req.params.id,
        schoolId,
        ...(req.user!.role === "teacher" ? { class: { teacherId: req.user!.teacherId } } : {}),
      },
    });
    if (!exam) return res.status(404).json({ success: false, error: "Exam not found" });

    const subject = await prisma.subject.findFirst({ where: { id: req.body.subjectId, schoolId } });
    if (!subject) return res.status(400).json({ success: false, error: "Subject not found for school" });

    const item = await prisma.examSubject.upsert({
      where: { examId_subjectId: { examId: req.params.id, subjectId: req.body.subjectId } },
      update: { maxMarks: req.body.maxMarks, passMarks: req.body.passMarks },
      create: {
        examId: req.params.id,
        subjectId: req.body.subjectId,
        maxMarks: req.body.maxMarks,
        passMarks: req.body.passMarks,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    res.status(201).json({ success: true, data: item });
  }
);

// GET /api/exams/:id/subjects
examsRouter.get(
  "/exams/:id/subjects",
  requireRoles("superadmin", "school_admin", "teacher"),
  validateParams(idParam),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const exam = await prisma.exam.findFirst({
      where: {
        id: req.params.id,
        schoolId,
        ...(req.user!.role === "teacher" ? { class: { teacherId: req.user!.teacherId } } : {}),
      },
    });
    if (!exam) return res.status(404).json({ success: false, error: "Exam not found" });

    const items = await prisma.examSubject.findMany({
      where: { examId: req.params.id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { studentMarks: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, data: items });
  }
);

// PATCH /api/exam-subjects/:id
examsRouter.patch(
  "/exam-subjects/:id",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("exam.subject.update", "ExamSubject", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updateExamSubjectSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.examSubject.findFirst({
      where: {
        id: req.params.id,
        exam: {
          schoolId,
          ...(req.user!.role === "teacher" ? { class: { teacherId: req.user!.teacherId } } : {}),
        },
      },
      include: { exam: true },
    });

    if (!existing) return res.status(404).json({ success: false, error: "Exam subject not found" });

    const nextMaxMarks = req.body.maxMarks ?? Number(existing.maxMarks);
    const nextPassMarks = req.body.passMarks ?? Number(existing.passMarks);
    if (nextPassMarks > nextMaxMarks) {
      return res.status(400).json({ success: false, error: "passMarks cannot be greater than maxMarks" });
    }

    const item = await prisma.examSubject.update({
      where: { id: req.params.id },
      data: {
        maxMarks: req.body.maxMarks,
        passMarks: req.body.passMarks,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    const affectedStudentIds = await prisma.studentMark.findMany({
      where: { examSubjectId: item.id },
      select: { studentId: true },
      distinct: ["studentId"],
    });

    await Promise.all(affectedStudentIds.map((entry) => recalculateStudentResult(schoolId, existing.examId, entry.studentId)));
    await recalculateExamRanks(existing.examId, schoolId);

    res.json({ success: true, data: item });
  }
);

// DELETE /api/exam-subjects/:id
examsRouter.delete(
  "/exam-subjects/:id",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("exam.subject.delete", "ExamSubject", (req) => req.params.id),
  validateParams(idParam),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.examSubject.findFirst({
      where: {
        id: req.params.id,
        exam: {
          schoolId,
          ...(req.user!.role === "teacher" ? { class: { teacherId: req.user!.teacherId } } : {}),
        },
      },
      include: {
        exam: true,
        _count: { select: { studentMarks: true } },
      },
    });

    if (!existing) return res.status(404).json({ success: false, error: "Exam subject not found" });
    if (existing._count.studentMarks > 0) {
      return res.status(400).json({ success: false, error: "Cannot delete exam subject with marks" });
    }

    await prisma.examSubject.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  }
);

// POST /api/exams/:id/marks
examsRouter.post(
  "/exams/:id/marks",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("exam.mark.upsert", "StudentMark", (req) => req.params.id),
  validateParams(idParam),
  validateBody(createMarksSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const exam = await prisma.exam.findFirst({
      where: {
        id: req.params.id,
        schoolId,
        ...(req.user!.role === "teacher" ? { class: { teacherId: req.user!.teacherId } } : {}),
      },
    });
    if (!exam) return res.status(404).json({ success: false, error: "Exam not found" });

    const entries = req.body.items?.length
      ? req.body.items
      : [{
          examSubjectId: req.body.examSubjectId,
          studentId: req.body.studentId,
          marksObtained: req.body.marksObtained,
          remarks: req.body.remarks,
        }];

    const upserted = [];
    const affectedStudents = new Set<string>();

    for (const entry of entries) {
      const examSubject = await prisma.examSubject.findFirst({
        where: { id: entry.examSubjectId, examId: req.params.id },
        include: { exam: true },
      });
      if (!examSubject) return res.status(400).json({ success: false, error: `Invalid examSubjectId: ${entry.examSubjectId}` });

      const student = await prisma.student.findFirst({
        where: { id: entry.studentId, schoolId, classId: exam.classId },
      });
      if (!student) return res.status(400).json({ success: false, error: `Student not found in exam class: ${entry.studentId}` });

      if (Number(entry.marksObtained) > Number(examSubject.maxMarks)) {
        return res.status(400).json({ success: false, error: `Marks cannot exceed max marks (${examSubject.maxMarks})` });
      }

      const grade = gradeFromMarks(Number(entry.marksObtained), Number(examSubject.maxMarks));
      const mark = await prisma.studentMark.upsert({
        where: {
          examSubjectId_studentId: {
            examSubjectId: entry.examSubjectId,
            studentId: entry.studentId,
          },
        },
        update: {
          marksObtained: entry.marksObtained,
          grade,
          remarks: entry.remarks,
        },
        create: {
          schoolId,
          examSubjectId: entry.examSubjectId,
          studentId: entry.studentId,
          marksObtained: entry.marksObtained,
          grade,
          remarks: entry.remarks,
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
          examSubject: { include: { subject: { select: { id: true, name: true, code: true } } } },
        },
      });

      upserted.push(mark);
      affectedStudents.add(entry.studentId);
    }

    await Promise.all(Array.from(affectedStudents).map((studentId) => recalculateStudentResult(schoolId, req.params.id, studentId)));
    await recalculateExamRanks(req.params.id, schoolId);

    res.status(201).json({ success: true, data: upserted });
  }
);

// PATCH /api/marks/:id
examsRouter.patch(
  "/marks/:id",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("exam.mark.update", "StudentMark", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updateMarkSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.studentMark.findFirst({
      where: { id: req.params.id, schoolId },
      include: {
        examSubject: {
          include: {
            exam: true,
          },
        },
      },
    });

    if (!existing) return res.status(404).json({ success: false, error: "Mark not found" });

    const marksObtained = req.body.marksObtained ?? Number(existing.marksObtained);
    if (Number(marksObtained) > Number(existing.examSubject.maxMarks)) {
      return res.status(400).json({ success: false, error: `Marks cannot exceed max marks (${existing.examSubject.maxMarks})` });
    }

    const grade = gradeFromMarks(Number(marksObtained), Number(existing.examSubject.maxMarks));
    const updated = await prisma.studentMark.update({
      where: { id: req.params.id },
      data: {
        marksObtained,
        grade,
        remarks: req.body.remarks === undefined ? undefined : req.body.remarks,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        examSubject: { include: { subject: { select: { id: true, name: true, code: true } } } },
      },
    });

    await recalculateStudentResult(schoolId, existing.examSubject.examId, existing.studentId);
    await recalculateExamRanks(existing.examSubject.examId, schoolId);

    res.json({ success: true, data: updated });
  }
);

// GET /api/exams/:id/marks
examsRouter.get(
  "/exams/:id/marks",
  requireRoles("superadmin", "school_admin", "teacher"),
  validateParams(idParam),
  validateQuery(examMarksQuery),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const exam = await prisma.exam.findFirst({ where: { id: req.params.id, schoolId } });
    if (!exam) return res.status(404).json({ success: false, error: "Exam not found" });

    const subjects = await prisma.examSubject.findMany({
      where: { examId: req.params.id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        studentMarks: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
          },
          orderBy: { student: { admissionNumber: "asc" } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, data: { examId: req.params.id, subjects } });
  }
);

// GET /api/results/student/:studentId
examsRouter.get(
  "/results/student/:studentId",
  requireRoles("superadmin", "school_admin", "teacher", "parent", "student"),
  validateParams(studentIdParam),
  validateQuery(studentResultsQuery),
  async (req, res) => {
    const access = await ensureStudentAccess(req, req.params.studentId);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });

    const items = await prisma.examResult.findMany({
      where: {
        schoolId: access.schoolId,
        studentId: req.params.studentId,
      },
      include: {
        exam: {
          include: {
            class: { select: { id: true, name: true, grade: true } },
            academicYear: { select: { id: true, name: true, isActive: true } },
          },
        },
      },
      orderBy: { exam: { startDate: "desc" } },
    });

    res.json({ success: true, data: items });
  }
);

// GET /api/results/exam/:examId
examsRouter.get(
  "/results/exam/:examId",
  requireRoles("superadmin", "school_admin", "teacher"),
  validateParams(examIdParam),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const exam = await prisma.exam.findFirst({
      where: {
        id: req.params.examId,
        schoolId,
        ...(req.user!.role === "teacher" ? { class: { teacherId: req.user!.teacherId } } : {}),
      },
      include: {
        class: { select: { id: true, name: true, grade: true } },
        academicYear: { select: { id: true, name: true, isActive: true } },
      },
    });
    if (!exam) return res.status(404).json({ success: false, error: "Exam not found" });

    const results = await prisma.examResult.findMany({
      where: { examId: req.params.examId, schoolId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      },
      orderBy: [{ rank: "asc" }, { percentage: "desc" }],
    });

    const summary = {
      studentCount: results.length,
      averagePercentage: results.length
        ? Number((results.reduce((sum, r) => sum + Number(r.percentage), 0) / results.length).toFixed(2))
        : 0,
      passCount: results.filter((r) => Number(r.percentage) >= 50).length,
      topper: results[0]
        ? {
            studentId: results[0].studentId,
            name: `${results[0].student.firstName} ${results[0].student.lastName}`,
            percentage: Number(results[0].percentage),
          }
        : null,
    };

    res.json({ success: true, data: { exam, results, summary } });
  }
);

// GET /api/results/class/:classId
examsRouter.get(
  "/results/class/:classId",
  requireRoles("superadmin", "school_admin", "teacher"),
  validateParams(classIdParam),
  validateQuery(classResultsQuery),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const classEntity = await prisma.class.findFirst({
      where: {
        id: req.params.classId,
        schoolId,
        ...(req.user!.role === "teacher" ? { teacherId: req.user!.teacherId } : {}),
      },
    });
    if (!classEntity) return res.status(404).json({ success: false, error: "Class not found" });

    const examWhere: Record<string, unknown> = { schoolId, classId: req.params.classId };
    if (req.query.academicYearId) examWhere.academicYearId = String(req.query.academicYearId);
    if (req.query.examId) examWhere.id = String(req.query.examId);

    const exams = await prisma.exam.findMany({
      where: examWhere,
      include: {
        academicYear: { select: { id: true, name: true, isActive: true } },
        results: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
          },
          orderBy: [{ rank: "asc" }, { percentage: "desc" }],
        },
      },
      orderBy: { startDate: "desc" },
    });

    const summary = {
      examCount: exams.length,
      resultCount: exams.reduce((sum, exam) => sum + exam.results.length, 0),
      averagePercentage: (() => {
        const all = exams.flatMap((exam) => exam.results);
        if (!all.length) return 0;
        return Number((all.reduce((sum, row) => sum + Number(row.percentage), 0) / all.length).toFixed(2));
      })(),
    };

    res.json({ success: true, data: { class: classEntity, exams, summary } });
  }
);

// GET /api/report-card/:studentId/:examId
examsRouter.get(
  "/report-card/:studentId/:examId",
  requireRoles("superadmin", "school_admin", "teacher", "parent", "student"),
  validateParams(reportCardParams),
  async (req, res) => {
    const access = await ensureStudentAccess(req, req.params.studentId);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });

    const exam = await prisma.exam.findFirst({
      where: {
        id: req.params.examId,
        schoolId: access.schoolId,
        ...(req.user!.role === "teacher" ? { class: { teacherId: req.user!.teacherId } } : {}),
      },
      include: {
        school: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, grade: true } },
        academicYear: { select: { id: true, name: true, isActive: true } },
        examSubjects: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            studentMarks: {
              where: { studentId: req.params.studentId },
              take: 1,
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!exam) return res.status(404).json({ success: false, error: "Exam not found" });

    const student = await prisma.student.findFirst({
      where: { id: req.params.studentId, schoolId: access.schoolId },
      include: {
        class: { select: { id: true, name: true, grade: true, section: true } },
      },
    });

    if (!student) return res.status(404).json({ success: false, error: "Student not found" });

    const result = await prisma.examResult.findUnique({
      where: { examId_studentId: { examId: exam.id, studentId: student.id } },
    });

    const subjectRows = exam.examSubjects.map((examSubject) => {
      const mark = examSubject.studentMarks[0];
      return {
        examSubjectId: examSubject.id,
        subject: examSubject.subject,
        maxMarks: Number(examSubject.maxMarks),
        passMarks: Number(examSubject.passMarks),
        marksObtained: mark ? Number(mark.marksObtained) : null,
        grade: mark?.grade ?? null,
        remarks: mark?.remarks ?? null,
      };
    });

    const totalMaxMarks = subjectRows.reduce((sum, item) => sum + item.maxMarks, 0);
    const totalObtained = subjectRows.reduce((sum, item) => sum + (item.marksObtained ?? 0), 0);
    const percentage = totalMaxMarks > 0 ? Number(((totalObtained / totalMaxMarks) * 100).toFixed(2)) : 0;

    res.json({
      success: true,
      data: {
        school: exam.school,
        student: {
          id: student.id,
          admissionNumber: student.admissionNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          grade: student.grade,
          section: student.section,
          class: student.class,
        },
        exam: {
          id: exam.id,
          name: exam.name,
          description: exam.description,
          startDate: exam.startDate,
          endDate: exam.endDate,
          status: exam.status,
          class: exam.class,
          academicYear: exam.academicYear,
        },
        subjects: subjectRows,
        totals: {
          totalMarks: result ? Number(result.totalMarks) : totalObtained,
          totalMaxMarks,
          percentage: result ? Number(result.percentage) : percentage,
          gpa: result ? Number(result.gpa) : Number(gpaFromPercentage(percentage).toFixed(2)),
          grade: gradeFromPercentage(result ? Number(result.percentage) : percentage),
          rank: result?.rank ?? null,
        },
      },
    });
  }
);
