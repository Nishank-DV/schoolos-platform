import { Router } from "express";
import { z } from "zod";
import { paginationSchema } from "shared-utils";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { auditLog } from "../middleware/audit.js";

const idParam = z.object({ id: z.string().cuid() });

const classesListQuery = paginationSchema.extend({
  schoolId: z.string().cuid().optional(),
});

const createClassSchema = z.object({
  schoolId: z.string().cuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  grade: z.number().int().min(1).max(12),
  section: z.string().min(1),
  teacherId: z.string().cuid().optional(),
});

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  grade: z.number().int().min(1).max(12).optional(),
  section: z.string().min(1).optional(),
  teacherId: z.string().cuid().optional().nullable(),
});

const sectionsListQuery = paginationSchema.extend({
  schoolId: z.string().cuid().optional(),
  classId: z.string().min(1).optional(),
});

const createSectionSchema = z.object({
  schoolId: z.string().cuid().optional(),
  classId: z.string().cuid(),
  name: z.string().min(1),
  capacity: z.number().int().min(0).default(0),
});

const updateSectionSchema = z.object({
  classId: z.string().cuid().optional(),
  name: z.string().min(1).optional(),
  capacity: z.number().int().min(0).optional(),
});

const subjectsListQuery = paginationSchema.extend({
  schoolId: z.string().cuid().optional(),
  classId: z.string().cuid().optional(),
});

const createSubjectSchema = z.object({
  schoolId: z.string().cuid().optional(),
  classId: z.string().cuid(),
  name: z.string().min(1),
  code: z.string().optional(),
});

const updateSubjectSchema = z.object({
  classId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).optional(),
  code: z.string().optional().nullable(),
});

const yearsListQuery = paginationSchema.extend({
  schoolId: z.string().cuid().optional(),
});

const createYearSchema = z.object({
  schoolId: z.string().cuid().optional(),
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean().optional(),
});

const updateYearSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

const assignmentsListQuery = paginationSchema.extend({
  schoolId: z.string().cuid().optional(),
  academicYearId: z.string().cuid().optional(),
  classId: z.string().cuid().optional(),
  sectionId: z.string().cuid().optional(),
  teacherId: z.string().cuid().optional(),
  subjectId: z.string().cuid().optional(),
});

const createAssignmentSchema = z.object({
  schoolId: z.string().cuid().optional(),
  teacherId: z.string().cuid(),
  subjectId: z.string().cuid(),
  classId: z.string().cuid(),
  sectionId: z.string().cuid(),
  academicYearId: z.string().cuid(),
});

export const academicsRouter = Router();
academicsRouter.use(authMiddleware);
academicsRouter.use(requireRoles("school_admin", "superadmin", "teacher"));

const requireAcademicWriteAccess = requireRoles("school_admin", "superadmin");

function effectiveSchoolId(req: import("express").Request, schoolIdFromInput?: string): string | undefined {
  if (req.user!.role === "school_admin") return req.user!.schoolId;
  return schoolIdFromInput ?? (req.query.schoolId as string | undefined);
}

// Classes
academicsRouter.get("/classes", validateQuery(classesListQuery), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const schoolId = effectiveSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const where = { schoolId };
  const [items, total] = await Promise.all([
    prisma.class.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: "asc" },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { students: true, sections: true, subjects: true } },
      },
    }),
    prisma.class.count({ where }),
  ]);

  res.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
});

academicsRouter.post(
  "/classes",
  requireAcademicWriteAccess,
  auditLog("academics.class.create", "Class", (req) => req.body?.name ?? null),
  validateBody(createClassSchema),
  async (req, res) => {
    const schoolId = effectiveSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    if (req.body.teacherId) {
      const teacher = await prisma.teacher.findFirst({ where: { id: req.body.teacherId, schoolId } });
      if (!teacher) return res.status(400).json({ success: false, error: "Teacher not found for school" });
    }

    const item = await prisma.class.create({
      data: {
        schoolId,
        name: req.body.name,
        description: req.body.description,
        grade: req.body.grade,
        section: req.body.section,
        teacherId: req.body.teacherId ?? null,
      },
    });

    res.status(201).json({ success: true, data: item });
  }
);

academicsRouter.get("/classes/:id", validateParams(idParam), async (req, res) => {
  const schoolId = effectiveSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const item = await prisma.class.findFirst({
    where: { id: req.params.id, schoolId },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      sections: { orderBy: { name: "asc" } },
      subjects: { orderBy: { name: "asc" } },
      teacherAssignments: { include: { teacher: true, subject: true, section: true, academicYear: true } },
    },
  });

  if (!item) return res.status(404).json({ success: false, error: "Class not found" });
  res.json({ success: true, data: item });
});

academicsRouter.patch(
  "/classes/:id",
  requireAcademicWriteAccess,
  auditLog("academics.class.update", "Class", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updateClassSchema),
  async (req, res) => {
    const schoolId = effectiveSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.class.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Class not found" });

    if (req.body.teacherId) {
      const teacher = await prisma.teacher.findFirst({ where: { id: req.body.teacherId, schoolId } });
      if (!teacher) return res.status(400).json({ success: false, error: "Teacher not found for school" });
    }

    const item = await prisma.class.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        description: req.body.description === undefined ? undefined : req.body.description,
        grade: req.body.grade,
        section: req.body.section,
        teacherId: req.body.teacherId === undefined ? undefined : req.body.teacherId,
      },
    });

    res.json({ success: true, data: item });
  }
);

academicsRouter.delete(
  "/classes/:id",
  requireAcademicWriteAccess,
  auditLog("academics.class.delete", "Class", (req) => req.params.id),
  validateParams(idParam),
  async (req, res) => {
    const schoolId = effectiveSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.class.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Class not found" });

    await prisma.class.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }
);

// Sections
academicsRouter.get("/sections", validateQuery(sectionsListQuery), async (req, res) => {
  const { page, pageSize, classId } = req.query as unknown as { page: number; pageSize: number; classId?: string };
  const schoolId = effectiveSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const where: { schoolId: string; classId?: string } = { schoolId };
  if (classId) where.classId = classId;

  const [items, total] = await Promise.all([
    prisma.section.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
      include: { class: { select: { id: true, name: true, grade: true } }, _count: { select: { teacherAssignments: true } } },
    }),
    prisma.section.count({ where }),
  ]);

  res.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
});

academicsRouter.post(
  "/sections",
  requireAcademicWriteAccess,
  auditLog("academics.section.create", "Section", (req) => req.body?.name ?? null),
  validateBody(createSectionSchema),
  async (req, res) => {
    const schoolId = effectiveSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const classEntity = await prisma.class.findFirst({ where: { id: req.body.classId, schoolId } });
    if (!classEntity) return res.status(400).json({ success: false, error: "Class not found for school" });

    const item = await prisma.section.create({
      data: {
        schoolId,
        classId: req.body.classId,
        name: req.body.name,
        capacity: req.body.capacity,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    res.status(201).json({ success: true, data: item });
  }
);

academicsRouter.patch(
  "/sections/:id",
  requireAcademicWriteAccess,
  auditLog("academics.section.update", "Section", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updateSectionSchema),
  async (req, res) => {
    const schoolId = effectiveSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.section.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Section not found" });

    if (req.body.classId) {
      const classEntity = await prisma.class.findFirst({ where: { id: req.body.classId, schoolId } });
      if (!classEntity) return res.status(400).json({ success: false, error: "Class not found for school" });
    }

    const item = await prisma.section.update({
      where: { id: req.params.id },
      data: {
        classId: req.body.classId,
        name: req.body.name,
        capacity: req.body.capacity,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    res.json({ success: true, data: item });
  }
);

academicsRouter.delete(
  "/sections/:id",
  requireAcademicWriteAccess,
  auditLog("academics.section.delete", "Section", (req) => req.params.id),
  validateParams(idParam),
  async (req, res) => {
    const schoolId = effectiveSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.section.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Section not found" });

    await prisma.section.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }
);

// Subjects
academicsRouter.get("/subjects", validateQuery(subjectsListQuery), async (req, res) => {
  const { page, pageSize, classId } = req.query as unknown as { page: number; pageSize: number; classId?: string };
  const schoolId = effectiveSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const where: { schoolId: string; classId?: string } = { schoolId };
  if (classId) where.classId = classId;

  const [items, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: "asc" },
      include: { class: { select: { id: true, name: true, grade: true } } },
    }),
    prisma.subject.count({ where }),
  ]);

  res.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
});

academicsRouter.post(
  "/subjects",
  requireAcademicWriteAccess,
  auditLog("academics.subject.create", "Subject", (req) => req.body?.name ?? null),
  validateBody(createSubjectSchema),
  async (req, res) => {
    const schoolId = effectiveSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const classEntity = await prisma.class.findFirst({ where: { id: req.body.classId, schoolId } });
    if (!classEntity) return res.status(400).json({ success: false, error: "Class not found for school" });

    const item = await prisma.subject.create({
      data: {
        schoolId,
        classId: req.body.classId,
        name: req.body.name,
        code: req.body.code,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    res.status(201).json({ success: true, data: item });
  }
);

academicsRouter.patch(
  "/subjects/:id",
  requireAcademicWriteAccess,
  auditLog("academics.subject.update", "Subject", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updateSubjectSchema),
  async (req, res) => {
    const schoolId = effectiveSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.subject.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Subject not found" });

    if (req.body.classId) {
      const classEntity = await prisma.class.findFirst({ where: { id: req.body.classId, schoolId } });
      if (!classEntity) return res.status(400).json({ success: false, error: "Class not found for school" });
    }

    const item = await prisma.subject.update({
      where: { id: req.params.id },
      data: {
        classId: req.body.classId === undefined ? undefined : req.body.classId,
        name: req.body.name,
        code: req.body.code === undefined ? undefined : req.body.code,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    res.json({ success: true, data: item });
  }
);

academicsRouter.delete(
  "/subjects/:id",
  requireAcademicWriteAccess,
  auditLog("academics.subject.delete", "Subject", (req) => req.params.id),
  validateParams(idParam),
  async (req, res) => {
    const schoolId = effectiveSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.subject.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Subject not found" });

    await prisma.subject.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }
);

// Academic Years
academicsRouter.get("/years", validateQuery(yearsListQuery), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const schoolId = effectiveSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const where = { schoolId };
  const [items, total] = await Promise.all([
    prisma.academicYear.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { startDate: "desc" } }),
    prisma.academicYear.count({ where }),
  ]);

  res.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
});

academicsRouter.post(
  "/years",
  requireAcademicWriteAccess,
  auditLog("academics.year.create", "AcademicYear", (req) => req.body?.name ?? null),
  validateBody(createYearSchema),
  async (req, res) => {
    const schoolId = effectiveSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, error: "Invalid startDate or endDate" });
    }
    if (startDate >= endDate) return res.status(400).json({ success: false, error: "startDate must be before endDate" });

    const item = await prisma.$transaction(async (tx) => {
      if (req.body.isActive) {
        await tx.academicYear.updateMany({ where: { schoolId }, data: { isActive: false } });
      }
      return tx.academicYear.create({
        data: {
          schoolId,
          name: req.body.name,
          startDate,
          endDate,
          isActive: req.body.isActive ?? false,
        },
      });
    });

    res.status(201).json({ success: true, data: item });
  }
);

academicsRouter.patch(
  "/years/:id",
  requireAcademicWriteAccess,
  auditLog("academics.year.update", "AcademicYear", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updateYearSchema),
  async (req, res) => {
    const schoolId = effectiveSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.academicYear.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Academic year not found" });

    const startDate = req.body.startDate ? new Date(req.body.startDate) : undefined;
    const endDate = req.body.endDate ? new Date(req.body.endDate) : undefined;
    if (startDate && Number.isNaN(startDate.getTime())) return res.status(400).json({ success: false, error: "Invalid startDate" });
    if (endDate && Number.isNaN(endDate.getTime())) return res.status(400).json({ success: false, error: "Invalid endDate" });

    const nextStart = startDate ?? existing.startDate;
    const nextEnd = endDate ?? existing.endDate;
    if (nextStart >= nextEnd) return res.status(400).json({ success: false, error: "startDate must be before endDate" });

    const item = await prisma.$transaction(async (tx) => {
      if (req.body.isActive) {
        await tx.academicYear.updateMany({ where: { schoolId }, data: { isActive: false } });
      }
      return tx.academicYear.update({
        where: { id: req.params.id },
        data: {
          name: req.body.name,
          startDate,
          endDate,
          isActive: req.body.isActive,
        },
      });
    });

    res.json({ success: true, data: item });
  }
);

// Teacher Assignments
academicsRouter.get("/assignments", validateQuery(assignmentsListQuery), async (req, res) => {
  const { page, pageSize, academicYearId, classId, sectionId, teacherId, subjectId } = req.query as unknown as {
    page: number;
    pageSize: number;
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    teacherId?: string;
    subjectId?: string;
  };
  const schoolId = effectiveSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const where: {
    schoolId: string;
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    teacherId?: string;
    subjectId?: string;
  } = { schoolId };

  if (academicYearId) where.academicYearId = academicYearId;
  if (classId) where.classId = classId;
  if (sectionId) where.sectionId = sectionId;
  if (teacherId) where.teacherId = teacherId;
  if (subjectId) where.subjectId = subjectId;

  const [items, total] = await Promise.all([
    prisma.teacherAssignment.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, grade: true } },
        section: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true, isActive: true } },
      },
    }),
    prisma.teacherAssignment.count({ where }),
  ]);

  res.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
});

academicsRouter.post(
  "/assignments",
  requireAcademicWriteAccess,
  auditLog("academics.assignment.create", "TeacherAssignment", (req) => req.body?.teacherId ?? null),
  validateBody(createAssignmentSchema),
  async (req, res) => {
    const schoolId = effectiveSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const [teacher, subject, classEntity, section, academicYear] = await Promise.all([
      prisma.teacher.findFirst({ where: { id: req.body.teacherId, schoolId } }),
      prisma.subject.findFirst({ where: { id: req.body.subjectId, schoolId } }),
      prisma.class.findFirst({ where: { id: req.body.classId, schoolId } }),
      prisma.section.findFirst({ where: { id: req.body.sectionId, schoolId } }),
      prisma.academicYear.findFirst({ where: { id: req.body.academicYearId, schoolId } }),
    ]);

    if (!teacher) return res.status(400).json({ success: false, error: "Teacher not found for school" });
    if (!subject) return res.status(400).json({ success: false, error: "Subject not found for school" });
    if (!classEntity) return res.status(400).json({ success: false, error: "Class not found for school" });
    if (!section) return res.status(400).json({ success: false, error: "Section not found for school" });
    if (!academicYear) return res.status(400).json({ success: false, error: "Academic year not found for school" });
    if (section.classId !== classEntity.id) return res.status(400).json({ success: false, error: "Section does not belong to class" });
    if (subject.classId && subject.classId !== classEntity.id) {
      return res.status(400).json({ success: false, error: "Subject does not belong to class" });
    }

    const item = await prisma.teacherAssignment.create({
      data: {
        schoolId,
        teacherId: req.body.teacherId,
        subjectId: req.body.subjectId,
        classId: req.body.classId,
        sectionId: req.body.sectionId,
        academicYearId: req.body.academicYearId,
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ success: true, data: item });
  }
);
