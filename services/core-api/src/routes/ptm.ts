import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateParams } from "../middleware/validate.js";
import { z } from "zod";

const idParam = z.object({ id: z.string().cuid() });
const slotBody = z.object({
  teacherId: z.string().cuid().optional(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  maxBookings: z.number().int().min(1).optional(),
});

export const ptmRouter = Router();
ptmRouter.use(authMiddleware);

// List slots (admin/teacher); parent sees slots for their school
ptmRouter.get("/slots", async (req, res) => {
  let schoolId = req.user!.schoolId;
  if (!schoolId && req.user!.parentId) {
    const parent = await prisma.parent.findUnique({
      where: { id: req.user!.parentId },
      select: { schoolId: true },
    });
    schoolId = parent?.schoolId ?? undefined;
  }
  if (!schoolId) return res.json({ success: true, data: [] });
  const slots = await prisma.ptmSlot.findMany({
    where: { schoolId },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { bookings: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  const data = slots.map((s) => ({
    ...s,
    bookedCount: s._count.bookings,
  }));
  res.json({ success: true, data });
});

ptmRouter.post("/slots", requireRoles("superadmin", "school_admin"), async (req, res) => {
  const schoolId = req.user!.schoolId;
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });
  const parsed = slotBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
  const slot = await prisma.ptmSlot.create({
    data: {
      schoolId,
      teacherId: parsed.data.teacherId,
      date: new Date(parsed.data.date),
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      maxBookings: parsed.data.maxBookings ?? 1,
    },
  });
  res.status(201).json({ success: true, data: slot });
});

ptmRouter.delete("/slots/:id", requireRoles("superadmin", "school_admin"), validateParams(idParam), async (req, res) => {
  await prisma.ptmSlot.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// Parent: book a slot
ptmRouter.post("/book", requireRoles("parent"), async (req, res) => {
  const parentId = req.user!.parentId!;
  const { slotId, studentId } = req.body;
  if (!slotId) return res.status(400).json({ success: false, error: "slotId required" });
  const slot = await prisma.ptmSlot.findFirst({
    where: { id: slotId },
    include: { _count: { select: { bookings: true } } },
  });
  if (!slot) return res.status(404).json({ success: false, error: "Slot not found" });
  if (slot._count.bookings >= slot.maxBookings) return res.status(400).json({ success: false, error: "Slot full" });
  const existing = await prisma.ptmBooking.findUnique({
    where: { slotId_parentId: { slotId, parentId } },
  });
  if (existing) return res.status(400).json({ success: false, error: "Already booked" });
  const booking = await prisma.ptmBooking.create({
    data: { slotId, parentId, studentId: studentId || null },
  });
  res.status(201).json({ success: true, data: booking });
});

ptmRouter.get("/my-bookings", requireRoles("parent"), async (req, res) => {
  const parentId = req.user!.parentId!;
  const bookings = await prisma.ptmBooking.findMany({
    where: { parentId },
    include: { slot: { include: { teacher: true } }, student: { select: { firstName: true, lastName: true } } },
  });
  res.json({ success: true, data: bookings });
});
