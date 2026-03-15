import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { createStudentSchema, paginationSchema } from "shared-utils";
import { z } from "zod";
import { auditLog } from "../middleware/audit.js";

const idParam = z.object({ id: z.string().cuid() });

export const studentsRouter = Router();
studentsRouter.use(authMiddleware);

function studentWhere(req: import("express").Request) {
  const u = req.user!;
  if (u.role === "superadmin") return { schoolId: req.query.schoolId as string | undefined };
  if (u.role === "school_admin" || u.role === "teacher") return { schoolId: u.schoolId! };
  if (u.role === "parent") return { parentId: u.parentId! };
  if (u.role === "student") return { id: u.studentId! };
  return {};
}

studentsRouter.get("/", validateQuery(paginationSchema), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const where: Record<string, unknown> = {};
  const base = studentWhere(req);
  Object.assign(where, base);
  if (req.query.grade) where.grade = Number(req.query.grade);
  if (req.query.classId) where.classId = req.query.classId;
  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ grade: "asc" }, { admissionNumber: "asc" }],
      include: {
        school: { select: { id: true, name: true } },
        parent: { select: { id: true, firstName: true, lastName: true, email: true } },
        class: { select: { id: true, name: true } },
      },
    }),
    prisma.student.count({ where }),
  ]);
  res.json({
    success: true,
    data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
});

studentsRouter.get("/:id", validateParams(idParam), async (req, res) => {
  const student = await prisma.student.findFirst({
    where: { id: req.params.id },
    include: {
      school: true,
      parent: true,
      class: true,
      careerProfile: true,
    },
  });
  if (!student) return res.status(404).json({ success: false, error: "Student not found" });
  const u = req.user!;
  if (u.role === "parent" && student.parentId !== u.parentId) return res.status(403).json({ success: false, error: "Forbidden" });
  if (u.role === "student" && student.id !== u.studentId) return res.status(403).json({ success: false, error: "Forbidden" });
  if ((u.role === "school_admin" || u.role === "teacher") && student.schoolId !== u.schoolId) return res.status(403).json({ success: false, error: "Forbidden" });
  res.json({ success: true, data: student });
});

// CareerBuddy: student context for AI
studentsRouter.get("/:id/context", requireRoles("superadmin", "school_admin", "teacher", "integration_service"), validateParams(idParam), async (req, res) => {
  const student = await prisma.student.findFirst({
    where: { id: req.params.id },
    include: { school: true, careerProfile: true },
  });
  if (!student) return res.status(404).json({ success: false, error: "Student not found" });
  const profile = student.careerProfile;
  res.json({
    success: true,
    data: {
      studentId: student.id,
      name: `${student.firstName} ${student.lastName}`,
      grade: student.grade,
      school: student.school.name,
      favoriteSubjects: profile?.favoriteSubjects ?? [],
      hobbies: profile?.hobbies ?? [],
      likedActivities: profile?.likedActivities ?? [],
      dislikedActivities: profile?.dislikedActivities ?? [],
    },
  });
});

studentsRouter.post("/", requireRoles("superadmin", "school_admin"), auditLog("student.create", "Student", (req) => req.body?.admissionNumber ?? null), validateBody(createStudentSchema), async (req, res) => {
  const schoolId = req.body.schoolId ?? req.user!.schoolId;
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  if (req.body.classId) {
    const classEntity = await prisma.class.findFirst({
      where: { id: req.body.classId, schoolId },
      select: { id: true, grade: true },
    });
    if (!classEntity) {
      return res.status(400).json({ success: false, error: "Selected class not found for school" });
    }
    if (classEntity.grade !== req.body.grade) {
      return res.status(400).json({ success: false, error: `Selected class is grade ${classEntity.grade}, but student grade is ${req.body.grade}` });
    }
  }

  const student = await prisma.student.create({
    data: { ...req.body, schoolId },
    include: { school: true, parent: true, class: true },
  });
  res.status(201).json({ success: true, data: student });
});

studentsRouter.patch("/:id", requireRoles("superadmin", "school_admin"), validateParams(idParam), async (req, res) => {
  const existing = await prisma.student.findUnique({ where: { id: req.params.id }, select: { id: true, schoolId: true, grade: true } });
  if (!existing) return res.status(404).json({ success: false, error: "Student not found" });

  const nextGrade = req.body.grade ?? existing.grade;
  if (req.body.classId) {
    const classEntity = await prisma.class.findFirst({
      where: { id: req.body.classId, schoolId: existing.schoolId },
      select: { id: true, grade: true },
    });
    if (!classEntity) {
      return res.status(400).json({ success: false, error: "Selected class not found for school" });
    }
    if (classEntity.grade !== nextGrade) {
      return res.status(400).json({ success: false, error: `Selected class is grade ${classEntity.grade}, but student grade is ${nextGrade}` });
    }
  }

  const student = await prisma.student.update({
    where: { id: req.params.id },
    data: req.body,
    include: { school: true, parent: true, class: true },
  });
  res.json({ success: true, data: student });
});

studentsRouter.delete("/:id", requireRoles("superadmin", "school_admin"), auditLog("student.delete", "Student", (req) => req.params.id), validateParams(idParam), async (req, res) => {
  await prisma.student.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
