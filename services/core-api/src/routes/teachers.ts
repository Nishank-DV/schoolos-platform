import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import { paginationSchema } from "shared-utils";
import { z } from "zod";

const idParam = z.object({ id: z.string().cuid() });

export const teachersRouter = Router();
teachersRouter.use(authMiddleware);

teachersRouter.get("/", requireRoles("superadmin", "school_admin", "teacher"), validateQuery(paginationSchema), async (req, res) => {
  const scopedSchoolId = req.user!.role === "school_admin" || req.user!.role === "teacher"
    ? req.user!.schoolId
    : (req.query.schoolId as string | undefined);

  if (scopedSchoolId) {
    const orphanUsers = await prisma.user.findMany({
      where: { role: "teacher", schoolId: scopedSchoolId, teacherId: null },
      select: { id: true, email: true },
      take: 200,
    });
    for (const user of orphanUsers) {
      const local = user.email.split("@")[0] ?? "teacher";
      const parts = local.replace(/[._-]+/g, " ").split(" ").filter(Boolean);
      const firstName = parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1) : "Teacher";
      const lastName = parts[1] ? parts[1][0].toUpperCase() + parts[1].slice(1) : "Account";
      const teacher = await prisma.teacher.create({
        data: {
          schoolId: scopedSchoolId,
          firstName,
          lastName,
          email: user.email,
          subjectIds: [],
        },
      });
      await prisma.user.update({ where: { id: user.id }, data: { teacherId: teacher.id } });
    }
  }

  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const where = req.user!.role === "school_admin" || req.user!.role === "teacher"
    ? { schoolId: req.user!.schoolId! }
    : req.query.schoolId ? { schoolId: req.query.schoolId as string } : {};
  const [items, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { school: { select: { id: true, name: true } } },
    }),
    prisma.teacher.count({ where }),
  ]);
  res.json({
    success: true,
    data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
});

teachersRouter.get("/:id", requireRoles("superadmin", "school_admin", "teacher"), validateParams(idParam), async (req, res) => {
  const teacher = await prisma.teacher.findFirst({
    where: { id: req.params.id },
    include: { school: true, classes: true },
  });
  if (!teacher) return res.status(404).json({ success: false, error: "Teacher not found" });
  res.json({ success: true, data: teacher });
});
