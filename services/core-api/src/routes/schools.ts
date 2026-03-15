import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { createSchoolSchema, paginationSchema } from "shared-utils";
import { z } from "zod";

const idParam = z.object({ id: z.string().cuid() });

export const schoolsRouter = Router();
schoolsRouter.use(authMiddleware);

schoolsRouter.get("/", requireRoles("superadmin", "school_admin"), validateQuery(paginationSchema), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const user = req.user!;
  const where = user.role === "school_admin" && user.schoolId
    ? { id: user.schoolId }
    : {};
  const [items, total] = await Promise.all([
    prisma.school.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: "asc" },
    }),
    prisma.school.count({ where }),
  ]);
  res.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

schoolsRouter.get("/:id", requireRoles("superadmin", "school_admin"), validateParams(idParam), async (req, res) => {
  const school = await prisma.school.findFirst({
    where: { id: req.params.id },
    include: {
      _count: { select: { students: true, teachers: true, classes: true } },
    },
  });
  if (!school) return res.status(404).json({ success: false, error: "School not found" });
  const u = req.user!;
  if (u.role === "school_admin" && u.schoolId !== school.id) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  res.json({ success: true, data: school });
});

schoolsRouter.post("/", requireRoles("superadmin"), validateBody(createSchoolSchema), async (req, res) => {
  const school = await prisma.school.create({ data: req.body });
  res.status(201).json({ success: true, data: school });
});

schoolsRouter.patch("/:id", requireRoles("superadmin", "school_admin"), validateParams(idParam), async (req, res) => {
  const school = await prisma.school.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ success: true, data: school });
});
