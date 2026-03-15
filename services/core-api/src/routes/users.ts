import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import { paginationSchema, createUserPasswordSchema } from "shared-utils";
import { z } from "zod";
import { auditLog } from "../middleware/audit.js";

const idParam = z.object({ id: z.string().cuid() });
const createUserSchema = z.object({
  email: z.string().email(),
  password: createUserPasswordSchema,
  role: z.enum(["superadmin", "school_admin", "teacher", "parent", "student", "integration_service"]),
  schoolId: z.string().cuid().optional().nullable(),
  studentId: z.string().cuid().optional().nullable(),
  parentId: z.string().cuid().optional().nullable(),
  teacherId: z.string().cuid().optional().nullable(),
});
const updateUserSchema = z.object({
  role: z.enum(["superadmin", "school_admin", "teacher", "parent", "student", "integration_service"]).optional(),
  schoolId: z.string().cuid().optional().nullable(),
  studentId: z.string().cuid().optional().nullable(),
  parentId: z.string().cuid().optional().nullable(),
  teacherId: z.string().cuid().optional().nullable(),
});

function deriveNamesFromEmail(email: string) {
  const local = email.split("@")[0] ?? "user";
  const normalized = local
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const parts = normalized.split(" ").filter(Boolean);
  const firstName = parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1) : "User";
  const lastName = parts[1] ? parts[1][0].toUpperCase() + parts[1].slice(1) : "Account";
  return { firstName, lastName };
}

export const usersRouter = Router();
usersRouter.use(authMiddleware);

usersRouter.get("/link-options", requireRoles("superadmin", "school_admin"), async (req, res) => {
  const schoolId = req.user!.role === "school_admin"
    ? req.user!.schoolId
    : (req.query.schoolId as string | undefined);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const [students, teachers, parents] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true, grade: true },
      orderBy: [{ grade: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
      take: 200,
    }),
    prisma.teacher.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 200,
    }),
    prisma.parent.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 200,
    }),
  ]);

  res.json({ success: true, data: { students, teachers, parents } });
});

// List users (admin only) – filter by school, role
usersRouter.get("/", requireRoles("superadmin", "school_admin"), validateQuery(paginationSchema), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const u = req.user!;
  const where: Prisma.UserWhereInput = {};
  if (u.role === "school_admin" && u.schoolId) where.schoolId = u.schoolId;
  if (req.query.role && typeof req.query.role === "string") where.role = req.query.role as Prisma.UserWhereInput["role"];
  if (req.query.schoolId && typeof req.query.schoolId === "string") where.schoolId = req.query.schoolId;
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        schoolId: true,
        studentId: true,
        parentId: true,
        teacherId: true,
        createdAt: true,
        school: { select: { id: true, name: true } },
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        parent: { select: { id: true, firstName: true, lastName: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  res.json({
    success: true,
    data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
});

// Create user (admin) – set role and optionally link to student/parent/teacher
usersRouter.post("/", requireRoles("superadmin", "school_admin"), auditLog("user.create", "User", (req) => req.body?.email ?? null), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.message });
  }
  const { email, password, role, schoolId, studentId, parentId, teacherId } = parsed.data;
  const u = req.user!;
  const effectiveSchoolId = schoolId ?? (u.role === "school_admin" ? u.schoolId : undefined);
  if (role !== "superadmin" && !effectiveSchoolId) {
    return res.status(400).json({ success: false, error: "schoolId required for this role" });
  }

  let resolvedStudentId = studentId ?? null;
  let resolvedParentId = parentId ?? null;
  let resolvedTeacherId = teacherId ?? null;

  if (role === "student") {
    if (!resolvedStudentId) {
      return res.status(400).json({ success: false, error: "studentId required for student role. Create student first or use Students page create-login." });
    }
    const student = await prisma.student.findFirst({ where: { id: resolvedStudentId, schoolId: effectiveSchoolId ?? undefined } });
    if (!student) return res.status(400).json({ success: false, error: "Selected student not found for school" });
  }

  if (role === "teacher") {
    if (resolvedTeacherId) {
      const teacher = await prisma.teacher.findFirst({ where: { id: resolvedTeacherId, schoolId: effectiveSchoolId ?? undefined } });
      if (!teacher) return res.status(400).json({ success: false, error: "Selected teacher not found for school" });
    } else {
      const names = deriveNamesFromEmail(email);
      const teacher = await prisma.teacher.create({
        data: {
          schoolId: effectiveSchoolId!,
          firstName: names.firstName,
          lastName: names.lastName,
          email,
          subjectIds: [],
        },
      });
      resolvedTeacherId = teacher.id;
    }
  }

  if (role === "parent") {
    if (resolvedParentId) {
      const parent = await prisma.parent.findFirst({ where: { id: resolvedParentId, schoolId: effectiveSchoolId ?? undefined } });
      if (!parent) return res.status(400).json({ success: false, error: "Selected parent not found for school" });
    } else {
      const names = deriveNamesFromEmail(email);
      const parent = await prisma.parent.create({
        data: {
          schoolId: effectiveSchoolId!,
          firstName: names.firstName,
          lastName: names.lastName,
          email,
        },
      });
      resolvedParentId = parent.id;
    }
  }

  if (role !== "student") resolvedStudentId = null;
  if (role !== "parent") resolvedParentId = null;
  if (role !== "teacher") resolvedTeacherId = null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ success: false, error: "Email already registered" });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: role as import("@prisma/client").Role,
      schoolId: effectiveSchoolId ?? null,
      studentId: resolvedStudentId,
      parentId: resolvedParentId,
      teacherId: resolvedTeacherId,
    },
    select: {
      id: true,
      email: true,
      role: true,
      schoolId: true,
      studentId: true,
      parentId: true,
      teacherId: true,
      school: { select: { name: true } },
      student: { select: { firstName: true, lastName: true } },
      parent: { select: { firstName: true, lastName: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });
  res.status(201).json({ success: true, data: user });
});

// Update user (role / links) – admin only
usersRouter.patch("/:id", requireRoles("superadmin", "school_admin"), auditLog("user.update", "User", (req) => req.params.id), async (req, res) => {
  const parsed = idParam.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ success: false, error: "Invalid id" });
  const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
  if (!target) return res.status(404).json({ success: false, error: "User not found" });
  const u = req.user!;
  if (u.role === "school_admin" && target.schoolId !== u.schoolId) {
    return res.status(403).json({ success: false, error: "Cannot edit users of another school" });
  }
  const body = updateUserSchema.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: body.error.message });
  const updated = await prisma.user.update({
    where: { id: parsed.data.id },
    data: body.data,
    select: {
      id: true,
      email: true,
      role: true,
      schoolId: true,
      studentId: true,
      parentId: true,
      teacherId: true,
    },
  });
  res.json({ success: true, data: updated });
});

// Delete user – superadmin or school_admin (own school only)
usersRouter.delete("/:id", requireRoles("superadmin", "school_admin"), auditLog("user.delete", "User", (req) => req.params.id), async (req, res) => {
  const parsed = idParam.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ success: false, error: "Invalid id" });
  const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
  if (!target) return res.status(404).json({ success: false, error: "User not found" });
  const u = req.user!;
  if (u.role === "school_admin" && target.schoolId !== u.schoolId) {
    return res.status(403).json({ success: false, error: "Cannot delete users of another school" });
  }
  if (target.role === "superadmin" && u.role !== "superadmin") {
    return res.status(403).json({ success: false, error: "Only superadmin can delete superadmin" });
  }
  await prisma.user.delete({ where: { id: parsed.data.id } });
  res.json({ success: true });
});
