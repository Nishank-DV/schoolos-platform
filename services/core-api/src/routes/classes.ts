import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import { paginationSchema } from "shared-utils";
import { z } from "zod";

const idParam = z.object({ id: z.string().cuid() });

export const classesRouter = Router();
classesRouter.use(authMiddleware);

classesRouter.get("/", requireRoles("superadmin", "school_admin", "teacher"), validateQuery(paginationSchema), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const where = req.user!.schoolId ? { schoolId: req.user!.schoolId } : (req.query.schoolId ? { schoolId: req.query.schoolId as string } : {});
  const [items, total] = await Promise.all([
    prisma.class.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        school: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { students: true } },
      },
    }),
    prisma.class.count({ where }),
  ]);
  res.json({
    success: true,
    data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
});

classesRouter.get("/:id", requireRoles("superadmin", "school_admin", "teacher"), validateParams(idParam), async (req, res) => {
  const classEntity = await prisma.class.findFirst({
    where: { id: req.params.id },
    include: {
      school: true,
      teacher: true,
      students: true,
      subjects: true,
      assignments: { include: { subject: true } },
    },
  });
  if (!classEntity) return res.status(404).json({ success: false, error: "Class not found" });
  res.json({ success: true, data: classEntity });
});
