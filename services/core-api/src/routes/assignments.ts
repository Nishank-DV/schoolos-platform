import { Router } from "express";
import { z } from "zod";
import { paginationSchema } from "shared-utils";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { auditLog } from "../middleware/audit.js";

const idParam = z.object({ id: z.string().cuid() });

const assignmentsListQuery = paginationSchema.extend({
  schoolId: z.string().cuid().optional(),
  classId: z.string().cuid().optional(),
  sectionId: z.string().cuid().optional(),
  teacherId: z.string().cuid().optional(),
  subjectId: z.string().cuid().optional(),
  academicYearId: z.string().cuid().optional(),
});

const createAssignmentSchema = z.object({
  schoolId: z.string().cuid().optional(),
  classId: z.string().cuid(),
  sectionId: z.string().cuid(),
  subjectId: z.string().cuid(),
  teacherId: z.string().cuid().optional(),
  academicYearId: z.string().cuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string(),
  maxMarks: z.number().int().min(0),
});

const updateAssignmentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional(),
  maxMarks: z.number().int().min(0).optional(),
});

const attachmentSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
});

const submitAssignmentSchema = z.object({
  fileUrl: z.string().url().optional(),
});

const gradeSubmissionSchema = z.object({
  grade: z.number().int().min(0).optional().nullable(),
  feedback: z.string().optional().nullable(),
});

const studentSubmissionsQuery = paginationSchema.extend({
  status: z.enum(["submitted", "graded", "pending"]).optional(),
});

export const assignmentsRouter = Router();
assignmentsRouter.use(authMiddleware);

function getSchoolId(req: import("express").Request, input?: string) {
  if (req.user!.role === "superadmin") return input ?? (req.query.schoolId as string | undefined);
  return req.user!.schoolId;
}

// GET /api/assignments - list assignments
assignmentsRouter.get("/", requireRoles("superadmin", "school_admin", "teacher", "student", "parent"), validateQuery(assignmentsListQuery), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  let where: Record<string, unknown> = { schoolId };
  if (req.query.classId) (where as any).classId = String(req.query.classId);
  if (req.query.sectionId) (where as any).sectionId = String(req.query.sectionId);
  if (req.query.teacherId) (where as any).teacherId = String(req.query.teacherId);
  if (req.query.subjectId) (where as any).subjectId = String(req.query.subjectId);
  if (req.query.academicYearId) (where as any).academicYearId = String(req.query.academicYearId);

  if (req.user!.role === "student") {
    const student = await prisma.student.findUnique({ where: { id: req.user!.studentId! }, select: { classId: true, id: true } });
    if (!student) return res.status(403).json({ success: false, error: "Student not found" });
    (where as any).classId = student.classId;
  }

  const [items, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { dueDate: "desc" },
      include: {
        class: { select: { id: true, name: true, grade: true } },
        section: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        academicYear: { select: { id: true, name: true, isActive: true } },
        _count: { select: { submissions: true } },
      },
    }),
    prisma.assignment.count({ where }),
  ]);

  res.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
});

// POST /api/assignments - create assignment
assignmentsRouter.post(
  "/",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("assignment.create", "Assignment", (req) => req.body?.title ?? null),
  validateBody(createAssignmentSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    if (req.user!.role === "teacher" && req.body.teacherId !== req.user!.teacherId) {
      return res.status(403).json({ success: false, error: "Teachers can only create their own assignments" });
    }

    const teacherId = req.body.teacherId || req.user!.teacherId;
    if (!teacherId) return res.status(400).json({ success: false, error: "teacherId required" });

    const [classEntity, section, subject, teacher, year] = await Promise.all([
      prisma.class.findFirst({ where: { id: req.body.classId, schoolId } }),
      prisma.section.findFirst({ where: { id: req.body.sectionId, schoolId } }),
      prisma.subject.findFirst({ where: { id: req.body.subjectId, schoolId } }),
      prisma.teacher.findFirst({ where: { id: teacherId, schoolId } }),
      prisma.academicYear.findFirst({ where: { id: req.body.academicYearId, schoolId } }),
    ]);

    if (!classEntity) return res.status(400).json({ success: false, error: "Class not found for school" });
    if (!section) return res.status(400).json({ success: false, error: "Section not found for school" });
    if (section.classId !== classEntity.id) return res.status(400).json({ success: false, error: "Section does not belong to class" });
    if (!subject) return res.status(400).json({ success: false, error: "Subject not found for school" });
    if (!teacher) return res.status(400).json({ success: false, error: "Teacher not found for school" });
    if (!year) return res.status(400).json({ success: false, error: "Academic year not found for school" });

    const dueDate = new Date(req.body.dueDate);
    const assignment = await prisma.assignment.create({
      data: {
        schoolId,
        classId: req.body.classId,
        sectionId: req.body.sectionId,
        subjectId: req.body.subjectId,
        teacherId,
        academicYearId: req.body.academicYearId,
        title: req.body.title,
        description: req.body.description,
        dueDate,
        maxMarks: req.body.maxMarks,
      },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ success: true, data: assignment });
  }
);

// GET /api/assignments/:id - get assignment details
assignmentsRouter.get("/:id", validateParams(idParam), async (req, res) => {
  const schoolId = getSchoolId(req);

  const assignment = await prisma.assignment.findFirst({
    where: { id: req.params.id, ...(schoolId ? { schoolId } : {}) },
    include: {
      class: { select: { id: true, name: true, grade: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      academicYear: { select: { id: true, name: true } },
      attachments: { select: { id: true, fileUrl: true, fileName: true, createdAt: true } },
      submissions: {
        select: {
          id: true,
          studentId: true,
          submittedAt: true,
          grade: true,
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        },
      },
    },
  });

  if (!assignment) return res.status(404).json({ success: false, error: "Assignment not found" });
  res.json({ success: true, data: assignment });
});

// PATCH /api/assignments/:id - update assignment
assignmentsRouter.patch(
  "/:id",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("assignment.update", "Assignment", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updateAssignmentSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.assignment.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Assignment not found" });

    if (req.user!.role === "teacher" && existing.teacherId !== req.user!.teacherId) {
      return res.status(403).json({ success: false, error: "Teachers can only update their own assignments" });
    }

    const data: Record<string, unknown> = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.dueDate !== undefined) data.dueDate = new Date(req.body.dueDate);
    if (req.body.maxMarks !== undefined) data.maxMarks = req.body.maxMarks;

    const assignment = await prisma.assignment.update({
      where: { id: req.params.id },
      data,
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, data: assignment });
  }
);

// DELETE /api/assignments/:id - delete assignment
assignmentsRouter.delete(
  "/:id",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("assignment.delete", "Assignment", (req) => req.params.id),
  validateParams(idParam),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.assignment.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Assignment not found" });

    if (req.user!.role === "teacher" && existing.teacherId !== req.user!.teacherId) {
      return res.status(403).json({ success: false, error: "Teachers can only delete their own assignments" });
    }

    await prisma.assignment.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  }
);

// POST /api/assignments/:id/attachments - add attachment
assignmentsRouter.post(
  "/:id/attachments",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("assignment.attachment.create", "AssignmentAttachment", (req) => req.params.id),
  validateParams(idParam),
  validateBody(attachmentSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const assignment = await prisma.assignment.findFirst({ where: { id: req.params.id, schoolId } });
    if (!assignment) return res.status(404).json({ success: false, error: "Assignment not found" });

    if (req.user!.role === "teacher" && assignment.teacherId !== req.user!.teacherId) {
      return res.status(403).json({ success: false, error: "Teachers can only attach files to their own assignments" });
    }

    const attachment = await prisma.assignmentAttachment.create({
      data: {
        assignmentId: req.params.id,
        fileUrl: req.body.fileUrl,
        fileName: req.body.fileName,
      },
    });

    res.status(201).json({ success: true, data: attachment });
  }
);

// DELETE /api/attachments/:id - delete attachment
assignmentsRouter.delete(
  "/attachments/:id",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("assignment.attachment.delete", "AssignmentAttachment", (req) => req.params.id),
  validateParams(idParam),
  async (req, res) => {
    const attachment = await prisma.assignmentAttachment.findUnique({ where: { id: req.params.id }, include: { assignment: true } });
    if (!attachment) return res.status(404).json({ success: false, error: "Attachment not found" });

    const schoolId = getSchoolId(req);
    if (schoolId && attachment.assignment.schoolId !== schoolId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    if (req.user!.role === "teacher" && attachment.assignment.teacherId !== req.user!.teacherId) {
      return res.status(403).json({ success: false, error: "Teachers can only delete their own attachments" });
    }

    await prisma.assignmentAttachment.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  }
);

// POST /api/assignments/:id/submit - student submit assignment
assignmentsRouter.post(
  "/:id/submit",
  requireRoles("student"),
  auditLog("assignment.submit", "AssignmentSubmission", (req) => req.params.id),
  validateParams(idParam),
  validateBody(submitAssignmentSchema),
  async (req, res) => {
    const studentId = req.user!.studentId!;
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) return res.status(404).json({ success: false, error: "Assignment not found" });

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: req.params.id, studentId } },
      update: { fileUrl: req.body.fileUrl, submittedAt: new Date() },
      create: {
        schoolId: assignment.schoolId,
        assignmentId: req.params.id,
        studentId,
        fileUrl: req.body.fileUrl,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        assignment: { select: { id: true, title: true, dueDate: true } },
      },
    });

    res.status(201).json({ success: true, data: submission });
  }
);

// GET /api/assignments/:id/submissions - list submissions for assignment
assignmentsRouter.get(
  "/:id/submissions",
  requireRoles("superadmin", "school_admin", "teacher"),
  validateParams(idParam),
  validateQuery(studentSubmissionsQuery),
  async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const assignment = await prisma.assignment.findFirst({ where: { id: req.params.id, schoolId } });
    if (!assignment) return res.status(404).json({ success: false, error: "Assignment not found" });

    if (req.user!.role === "teacher" && assignment.teacherId !== req.user!.teacherId) {
      return res.status(403).json({ success: false, error: "Teachers can only view submissions to their own assignments" });
    }

    const where: Record<string, unknown> = { assignmentId: req.params.id };
    if (req.query.status === "submitted") (where as any).grade = null;
    if (req.query.status === "graded") (where as any).grade = { not: null };
    if (req.query.status === "pending") {
      // pending = not submitted yet
      const submittedStudentIds = (
        await prisma.assignmentSubmission.findMany({ where: { assignmentId: req.params.id }, select: { studentId: true } })
      ).map((s) => s.studentId);
      const students = await prisma.student.findMany({ where: { classId: assignment.classId }, select: { id: true } });
      const pendingIds = students.filter((s) => !submittedStudentIds.includes(s.id)).map((s) => s.id);
      if (pendingIds.length === 0) {
        return res.json({ success: true, data: { items: [], total: 0, page, pageSize, totalPages: 0 } });
      }
    }

    const [items, total] = await Promise.all([
      prisma.assignmentSubmission.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { submittedAt: "desc" },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        },
      }),
      prisma.assignmentSubmission.count({ where }),
    ]);

    res.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  }
);

// PATCH /api/submissions/:id - grade submission
assignmentsRouter.patch(
  "/submissions/:id",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("assignment.grade", "AssignmentSubmission", (req) => req.params.id),
  validateParams(idParam),
  validateBody(gradeSubmissionSchema),
  async (req, res) => {
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: req.params.id },
      include: { assignment: true },
    });
    if (!submission) return res.status(404).json({ success: false, error: "Submission not found" });

    const schoolId = getSchoolId(req);
    if (schoolId && submission.assignment.schoolId !== schoolId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    if (req.user!.role === "teacher" && submission.assignment.teacherId !== req.user!.teacherId) {
      return res.status(403).json({ success: false, error: "Teachers can only grade submissions to their own assignments" });
    }

    const data: Record<string, unknown> = {};
    if (req.body.grade !== undefined) data.grade = req.body.grade;
    if (req.body.feedback !== undefined) data.feedback = req.body.feedback;

    const updated = await prisma.assignmentSubmission.update({
      where: { id: req.params.id },
      data,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        assignment: { select: { id: true, title: true } },
      },
    });

    res.json({ success: true, data: updated });
  }
);

