import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { paginationSchema } from "shared-utils";
import { z } from "zod";

const idParam = z.object({ id: z.string().cuid() });
const createBody = z.object({
  schoolId: z.string().cuid().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  grade: z.number().int().min(1).optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export const enquiriesRouter = Router();
enquiriesRouter.use(authMiddleware);

enquiriesRouter.get("/", requireRoles("superadmin", "school_admin"), validateQuery(paginationSchema), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const where = req.user!.schoolId ? { schoolId: req.user!.schoolId } : {};
  const [items, total] = await Promise.all([
    prisma.enquiry.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.enquiry.count({ where }),
  ]);
  res.json({
    success: true,
    data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
});

enquiriesRouter.get("/:id", requireRoles("superadmin", "school_admin"), validateParams(idParam), async (req, res) => {
  const enquiry = await prisma.enquiry.findFirst({
    where: { id: req.params.id },
  });
  if (!enquiry) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, data: enquiry });
});

enquiriesRouter.post("/", requireRoles("superadmin", "school_admin"), validateBody(createBody), async (req, res) => {
  const schoolId = req.body.schoolId ?? req.user!.schoolId;
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });
  const enquiry = await prisma.enquiry.create({
    data: {
      schoolId,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      grade: req.body.grade,
      source: req.body.source,
      notes: req.body.notes,
    },
  });
  res.status(201).json({ success: true, data: enquiry });
});

enquiriesRouter.patch("/:id", requireRoles("superadmin", "school_admin"), validateParams(idParam), async (req, res) => {
  const enquiry = await prisma.enquiry.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ success: true, data: enquiry });
});
