import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { z } from "zod";

const idParam = z.object({ id: z.string().cuid() });
const slotBody = z.object({
  classId: z.string().cuid(),
  subjectId: z.string().cuid(),
  teacherId: z.string().cuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  room: z.string().optional(),
});

export const timetableRouter = Router();
timetableRouter.use(authMiddleware);

timetableRouter.get("/", requireRoles("superadmin", "school_admin", "teacher"), async (req, res) => {
  const schoolId = req.user!.schoolId;
  if (!schoolId) return res.json({ success: true, data: [] });
  const slots = await prisma.timetableSlot.findMany({
    where: { schoolId },
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  res.json({ success: true, data: slots });
});

timetableRouter.get("/class/:classId", requireRoles("superadmin", "school_admin", "teacher"), async (req, res) => {
  const classId = req.params.classId;
  const slots = await prisma.timetableSlot.findMany({
    where: { classId },
    include: {
      subject: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  res.json({ success: true, data: slots });
});

timetableRouter.post("/", requireRoles("superadmin", "school_admin"), validateBody(slotBody), async (req, res) => {
  const schoolId = req.user!.schoolId;
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });
  const slot = await prisma.timetableSlot.create({
    data: { schoolId, ...req.body },
  });
  res.status(201).json({ success: true, data: slot });
});

timetableRouter.delete("/:id", requireRoles("superadmin", "school_admin"), validateParams(idParam), async (req, res) => {
  await prisma.timetableSlot.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
