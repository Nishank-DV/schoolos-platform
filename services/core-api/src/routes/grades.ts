import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import { paginationSchema } from "shared-utils";
import { z } from "zod";

const idParam = z.object({ id: z.string().cuid() });

export const gradesRouter = Router();
gradesRouter.use(authMiddleware);

gradesRouter.get("/", requireRoles("superadmin", "school_admin", "teacher"), validateQuery(paginationSchema), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const where = req.user!.schoolId ? { student: { schoolId: req.user!.schoolId } } : {};
  if (req.query.studentId) (where as Record<string, unknown>).studentId = req.query.studentId;
  if (req.query.term) (where as Record<string, unknown>).term = req.query.term;
  const [items, total] = await Promise.all([
    prisma.grade.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } }, subject: { select: { id: true, name: true } } },
    }),
    prisma.grade.count({ where }),
  ]);
  res.json({
    success: true,
    data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
});

gradesRouter.get("/student/:id", requireRoles("superadmin", "school_admin", "teacher", "parent", "student"), validateParams(idParam), async (req, res) => {
  const studentId = req.params.id;
  const u = req.user!;
  if (u.role === "student" && u.studentId !== studentId) return res.status(403).json({ success: false, error: "Forbidden" });
  if (u.role === "parent") {
    const s = await prisma.student.findFirst({ where: { id: studentId, parentId: u.parentId } });
    if (!s) return res.status(403).json({ success: false, error: "Forbidden" });
  }
  const grades = await prisma.grade.findMany({
    where: { studentId },
    include: { subject: { select: { name: true, code: true } } },
    orderBy: [{ term: "asc" }, { subjectId: "asc" }],
  });
  res.json({ success: true, data: grades });
});

gradesRouter.post("/", requireRoles("superadmin", "school_admin", "teacher"), async (req, res) => {
  const { studentId, subjectId, term, marks, maxMarks, grade } = req.body;
  if (!studentId || !subjectId || !term || marks == null || maxMarks == null) {
    return res.status(400).json({ success: false, error: "studentId, subjectId, term, marks, maxMarks required" });
  }
  const g = await prisma.grade.upsert({
    where: {
      studentId_subjectId_term: { studentId, subjectId, term },
    },
    update: { marks: Number(marks), maxMarks: Number(maxMarks), grade: grade ?? null },
    create: {
      studentId,
      subjectId,
      term,
      marks: Number(marks),
      maxMarks: Number(maxMarks),
      grade: grade ?? null,
    },
  });
  res.status(201).json({ success: true, data: g });
});

gradesRouter.patch("/:id", requireRoles("superadmin", "school_admin", "teacher"), validateParams(idParam), async (req, res) => {
  const g = await prisma.grade.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ success: true, data: g });
});
