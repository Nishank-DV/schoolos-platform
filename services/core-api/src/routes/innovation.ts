import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import { paginationSchema } from "shared-utils";
import { z } from "zod";

const idParam = z.object({ id: z.string().cuid() });

export const innovationRouter = Router();
innovationRouter.use(authMiddleware);

innovationRouter.get("/logs", requireRoles("superadmin", "school_admin", "teacher", "student"), validateQuery(paginationSchema), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const where: Record<string, unknown> = {};
  if (req.user!.role === "student") where.studentId = req.user!.studentId;
  else if (req.user!.schoolId) {
    where.student = { schoolId: req.user!.schoolId };
  }
  if (req.query.studentId) where.studentId = req.query.studentId;
  if (req.query.type) where.type = req.query.type;
  const [items, total] = await Promise.all([
    prisma.innovationLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.innovationLog.count({ where }),
  ]);
  res.json({
    success: true,
    data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
});

innovationRouter.post("/logs", requireRoles("superadmin", "school_admin", "teacher", "student"), async (req, res) => {
  const studentId = req.body.studentId ?? req.user!.studentId;
  if (!studentId) return res.status(400).json({ success: false, error: "studentId required" });
  const log = await prisma.innovationLog.create({
    data: {
      studentId,
      type: req.body.type ?? "research",
      title: req.body.title,
      description: req.body.description ?? null,
      evidenceUrl: req.body.evidenceUrl ?? null,
    },
  });
  res.status(201).json({ success: true, data: log });
});

innovationRouter.get("/certifications", requireRoles("superadmin", "school_admin", "teacher", "student"), validateQuery(paginationSchema), async (req, res) => {
  const where: Record<string, unknown> = {};
  if (req.user!.role === "student") where.studentId = req.user!.studentId;
  else if (req.query.studentId) where.studentId = req.query.studentId;
  const items = await prisma.skillCertification.findMany({
    where,
    orderBy: { certifiedAt: "desc" },
    include: { student: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.json({ success: true, data: items });
});

innovationRouter.post("/certifications", requireRoles("superadmin", "school_admin", "teacher"), async (req, res) => {
  const { studentId, skill, issuer, certifiedAt } = req.body;
  if (!studentId || !skill || !issuer) return res.status(400).json({ success: false, error: "studentId, skill, issuer required" });
  const cert = await prisma.skillCertification.create({
    data: {
      studentId,
      skill,
      issuer,
      certifiedAt: certifiedAt ? new Date(certifiedAt) : new Date(),
    },
  });
  res.status(201).json({ success: true, data: cert });
});

innovationRouter.delete("/logs/:id", requireRoles("superadmin", "school_admin", "teacher"), validateParams(idParam), async (req, res) => {
  await prisma.innovationLog.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
