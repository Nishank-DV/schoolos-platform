import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import { paginationSchema } from "shared-utils";
import { z } from "zod";

const idParam = z.object({ id: z.string().cuid() });
const createBody = z.object({
  schoolId: z.string().cuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  type: z.enum(["event", "holiday", "ptm"]).optional(),
});

export const eventsRouter = Router();
eventsRouter.use(authMiddleware);

eventsRouter.get("/", validateQuery(paginationSchema), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const where = req.user!.schoolId ? { schoolId: req.user!.schoolId } : {};
  const [items, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { startDate: "desc" },
    }),
    prisma.event.count({ where }),
  ]);
  res.json({
    success: true,
    data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
});

eventsRouter.get("/:id", validateParams(idParam), async (req, res) => {
  const event = await prisma.event.findFirst({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, data: event });
});

eventsRouter.post("/", requireRoles("superadmin", "school_admin"), async (req, res) => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
  const schoolId = parsed.data.schoolId ?? req.user!.schoolId;
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });
  const event = await prisma.event.create({
    data: {
      schoolId,
      title: parsed.data.title,
      description: parsed.data.description,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      type: parsed.data.type ?? "event",
    },
  });
  res.status(201).json({ success: true, data: event });
});

eventsRouter.patch("/:id", requireRoles("superadmin", "school_admin"), validateParams(idParam), async (req, res) => {
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ success: true, data: event });
});

eventsRouter.delete("/:id", requireRoles("superadmin", "school_admin"), validateParams(idParam), async (req, res) => {
  await prisma.event.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
