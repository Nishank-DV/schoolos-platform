import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { auditLog } from "../middleware/audit.js";
import { paginationSchema } from "shared-utils";
import { z } from "zod";

const idParam = z.object({ id: z.string().min(1) });
const studentIdParam = z.object({ studentId: z.string().min(1) });
const gradeParam = z.object({ grade: z.coerce.number().int().min(1).max(12) });
const paymentStatus = z.enum(["pending", "paid", "overdue"]);

const structuresQuery = paginationSchema.extend({
  schoolId: z.string().min(1).optional(),
  grade: z.coerce.number().int().min(1).max(12).optional(),
});

const paymentsQuery = paginationSchema.extend({
  schoolId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  status: paymentStatus.optional(),
  dueFrom: z.string().optional(),
  dueTo: z.string().optional(),
});

const createStructureSchema = z.object({
  schoolId: z.string().min(1).optional(),
  name: z.string().min(1),
  amount: z.number().positive(),
  grade: z.number().int().min(1).max(12).nullable().optional(),
  installments: z.number().int().min(1).max(24).optional(),
  lateFeePercent: z.number().min(0).max(100).nullable().optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
});

const updateStructureSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  grade: z.number().int().min(1).max(12).nullable().optional(),
  installments: z.number().int().min(1).max(24).optional(),
  lateFeePercent: z.number().min(0).max(100).nullable().optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
});

const assignFeesSchema = z
  .object({
    schoolId: z.string().min(1).optional(),
    feeStructureId: z.string().min(1),
    studentId: z.string().min(1).optional(),
    studentIds: z.array(z.string().min(1)).min(1).optional(),
    firstDueDate: z.string(),
    intervalDays: z.number().int().min(1).max(365).optional(),
    notes: z.string().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.studentId && !value.studentIds?.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide studentId or studentIds[]" });
    }
  });

const updatePaymentSchema = z.object({
  amount: z.number().positive().optional(),
  status: paymentStatus.optional(),
  dueDate: z.string().optional(),
  paidAt: z.string().nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
  paymentReference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const paySchema = z.object({
  paidAt: z.string().optional(),
  paymentMethod: z.string().nullable().optional(),
  paymentReference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const studentFinanceQuery = z.object({
  schoolId: z.string().min(1).optional(),
});

export const financeRouter = Router();
financeRouter.use(authMiddleware);

function getSchoolId(req: import("express").Request, input?: string) {
  if (req.user!.role === "superadmin") return input ?? (req.query.schoolId as string | undefined);
  return req.user!.schoolId;
}

function parseDateInput(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function todayStart() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function effectiveStatus(status: string, dueDate: Date) {
  if (status === "paid") return "paid";
  return dueDate < todayStart() ? "overdue" : "pending";
}

async function ensureStudentAccess(req: import("express").Request, studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, schoolId: true, parentId: true },
  });

  if (!student) return { ok: false as const, status: 404, error: "Student not found" };
  if (req.user!.role === "student" && req.user!.studentId !== student.id) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  if (req.user!.role === "parent" && req.user!.parentId !== student.parentId) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  if (req.user!.role === "school_admin" && req.user!.schoolId !== student.schoolId) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  const schoolId = req.user!.role === "superadmin"
    ? ((req.query.schoolId as string | undefined) ?? student.schoolId)
    : req.user!.schoolId;

  if (!schoolId || schoolId !== student.schoolId) {
    return { ok: false as const, status: 403, error: "School access denied" };
  }

  return { ok: true as const, schoolId, student };
}

// GET /api/finance/structures
financeRouter.get("/structures", requireRoles("superadmin", "school_admin"), validateQuery(structuresQuery), async (req, res) => {
  const { page, pageSize, grade } = req.query as unknown as { page: number; pageSize: number; grade?: number };
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const where: Record<string, unknown> = { schoolId };
  if (grade !== undefined) where.grade = grade;

  const [items, total] = await Promise.all([
    prisma.feeStructure.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ grade: "asc" }, { name: "asc" }],
      include: { _count: { select: { payments: true } } },
    }),
    prisma.feeStructure.count({ where }),
  ]);
  res.json({
    success: true,
    data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
});

// POST /api/finance/structures
financeRouter.post(
  "/structures",
  requireRoles("superadmin", "school_admin"),
  auditLog("finance.structure.create", "FeeStructure", (req) => req.body?.name ?? null),
  validateBody(createStructureSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const data = await prisma.feeStructure.create({
      data: {
        schoolId,
        name: req.body.name,
        amount: req.body.amount,
        grade: req.body.grade ?? null,
        installments: req.body.installments ?? 1,
        lateFeePercent: req.body.lateFeePercent ?? null,
        discountPercent: req.body.discountPercent ?? null,
      },
    });

    res.status(201).json({ success: true, data });
  }
);

// GET /api/finance/structures/:id
financeRouter.get("/structures/:id", requireRoles("superadmin", "school_admin"), validateParams(idParam), async (req, res) => {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });
  const data = await prisma.feeStructure.findFirst({
    where: { id: req.params.id, schoolId },
    include: { _count: { select: { payments: true } } },
  });
  if (!data) return res.status(404).json({ success: false, error: "Fee structure not found" });
  res.json({ success: true, data });
});

// PATCH /api/finance/structures/:id
financeRouter.patch(
  "/structures/:id",
  requireRoles("superadmin", "school_admin"),
  auditLog("finance.structure.update", "FeeStructure", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updateStructureSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });
    const existing = await prisma.feeStructure.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Fee structure not found" });
    const data = await prisma.feeStructure.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data });
  }
);

// DELETE /api/finance/structures/:id
financeRouter.delete(
  "/structures/:id",
  requireRoles("superadmin", "school_admin"),
  auditLog("finance.structure.delete", "FeeStructure", (req) => req.params.id),
  validateParams(idParam),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });
    const existing = await prisma.feeStructure.findFirst({
      where: { id: req.params.id, schoolId },
      include: { _count: { select: { payments: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, error: "Fee structure not found" });
    if (existing._count.payments > 0) {
      return res.status(400).json({ success: false, error: "Cannot delete fee structure with assigned payments" });
    }
    await prisma.feeStructure.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  }
);

// POST /api/finance/assign
financeRouter.post(
  "/assign",
  requireRoles("superadmin", "school_admin"),
  auditLog("finance.assign", "FeePayment", (req) => req.body?.feeStructureId ?? null),
  validateBody(assignFeesSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const firstDueDate = parseDateInput(req.body.firstDueDate);
    if (!firstDueDate) return res.status(400).json({ success: false, error: "Invalid firstDueDate" });

    const structure = await prisma.feeStructure.findFirst({ where: { id: req.body.feeStructureId, schoolId } });
    if (!structure) return res.status(404).json({ success: false, error: "Fee structure not found" });

    const targetIds = Array.from(new Set([...(req.body.studentId ? [req.body.studentId] : []), ...(req.body.studentIds ?? [])]));
    const students = await prisma.student.findMany({ where: { id: { in: targetIds }, schoolId }, select: { id: true, grade: true } });
    if (!students.length) return res.status(400).json({ success: false, error: "No valid students found for school" });
    if (structure.grade !== null && students.some((s) => s.grade !== structure.grade)) {
      return res.status(400).json({ success: false, error: "Student grade does not match fee structure grade" });
    }

    const intervalDays = req.body.intervalDays ?? 30;
    const installments = Math.max(1, Number(structure.installments));
    const netTotal = toMoney(Number(structure.amount) * (1 - Number(structure.discountPercent ?? 0) / 100));
    const baseInstallment = toMoney(netTotal / installments);

    let createdCount = 0;
    let skippedCount = 0;
    const createdIds: string[] = [];
    const now = todayStart();

    for (const student of students) {
      let allocated = 0;
      for (let i = 0; i < installments; i++) {
        const dueDate = new Date(firstDueDate);
        dueDate.setDate(dueDate.getDate() + i * intervalDays);

        const amount = i === installments - 1 ? toMoney(netTotal - allocated) : baseInstallment;
        allocated = toMoney(allocated + amount);

        const existing = await prisma.feePayment.findFirst({
          where: { studentId: student.id, feeStructureId: structure.id, dueDate },
          select: { id: true },
        });
        if (existing) {
          skippedCount += 1;
          continue;
        }

        const created = await prisma.feePayment.create({
          data: {
            studentId: student.id,
            feeStructureId: structure.id,
            amount,
            dueDate,
            status: dueDate < now ? "overdue" : "pending",
            notes: req.body.notes ?? null,
          },
        });
        createdCount += 1;
        createdIds.push(created.id);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        feeStructureId: structure.id,
        studentCount: students.length,
        createdCount,
        skippedCount,
        createdIds,
      },
    });
  }
);

// GET /api/finance/payments
financeRouter.get(
  "/payments",
  requireRoles("superadmin", "school_admin", "parent", "student"),
  validateQuery(paymentsQuery),
  async (req, res) => {
    const { page, pageSize, studentId, status, dueFrom, dueTo } = req.query as unknown as {
      page: number;
      pageSize: number;
      studentId?: string;
      status?: "pending" | "paid" | "overdue";
      dueFrom?: string;
      dueTo?: string;
    };

    const where: Record<string, unknown> = {};
    const schoolId = getSchoolId(req);

    if (req.user!.role === "school_admin" && schoolId) where.student = { schoolId };
    if (req.user!.role === "parent") where.student = { parentId: req.user!.parentId };
    if (req.user!.role === "student") where.studentId = req.user!.studentId;
    if (req.user!.role === "superadmin" && schoolId) where.student = { schoolId };

    if (studentId) {
      if (req.user!.role === "student" && req.user!.studentId !== studentId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      where.studentId = studentId;
    }
    if (status) where.status = status;
    if (dueFrom || dueTo) {
      const dueDate: Record<string, unknown> = {};
      if (dueFrom) {
        const parsed = parseDateInput(dueFrom);
        if (!parsed) return res.status(400).json({ success: false, error: "Invalid dueFrom" });
        dueDate.gte = parsed;
      }
      if (dueTo) {
        const parsed = parseDateInput(dueTo);
        if (!parsed) return res.status(400).json({ success: false, error: "Invalid dueTo" });
        dueDate.lte = parsed;
      }
      where.dueDate = dueDate;
    }

    const [itemsRaw, total] = await Promise.all([
      prisma.feePayment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, grade: true } },
          feeStructure: { select: { id: true, name: true, grade: true, lateFeePercent: true, discountPercent: true } },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      }),
      prisma.feePayment.count({ where }),
    ]);

    const items = itemsRaw.map((item) => ({ ...item, status: effectiveStatus(item.status, item.dueDate) }));
    res.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  }
);

// GET /api/finance/payments/:id
financeRouter.get(
  "/payments/:id",
  requireRoles("superadmin", "school_admin", "parent", "student"),
  validateParams(idParam),
  async (req, res) => {
    const data = await prisma.feePayment.findFirst({
      where: { id: req.params.id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, schoolId: true, parentId: true } },
        feeStructure: { select: { id: true, name: true, lateFeePercent: true, discountPercent: true } },
      },
    });
    if (!data) return res.status(404).json({ success: false, error: "Payment not found" });

    const schoolId = getSchoolId(req);
    if (req.user!.role === "school_admin" && schoolId !== data.student.schoolId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
    if (req.user!.role === "parent" && req.user!.parentId !== data.student.parentId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
    if (req.user!.role === "student" && req.user!.studentId !== data.student.id) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
    if (req.user!.role === "superadmin" && schoolId && schoolId !== data.student.schoolId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    res.json({ success: true, data: { ...data, status: effectiveStatus(data.status, data.dueDate) } });
  }
);

// PATCH /api/finance/payments/:id
financeRouter.patch(
  "/payments/:id",
  requireRoles("superadmin", "school_admin"),
  auditLog("finance.payment.update", "FeePayment", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updatePaymentSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.feePayment.findFirst({ where: { id: req.params.id, student: { schoolId } } });
    if (!existing) return res.status(404).json({ success: false, error: "Payment not found" });

    const data = await prisma.feePayment.update({
      where: { id: req.params.id },
      data: {
        amount: req.body.amount,
        status: req.body.status,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        paidAt: req.body.paidAt === null ? null : req.body.paidAt ? new Date(req.body.paidAt) : undefined,
        paymentMethod: req.body.paymentMethod,
        paymentReference: req.body.paymentReference,
        notes: req.body.notes,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        feeStructure: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, data });
  }
);

// POST /api/finance/payments/:id/pay
financeRouter.post(
  "/payments/:id/pay",
  requireRoles("superadmin", "school_admin"),
  auditLog("finance.payment.pay", "FeePayment", (req) => req.params.id),
  validateParams(idParam),
  validateBody(paySchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.feePayment.findFirst({
      where: { id: req.params.id, student: { schoolId } },
      include: { feeStructure: true },
    });
    if (!existing) return res.status(404).json({ success: false, error: "Payment not found" });
    if (existing.status === "paid") {
      return res.status(400).json({ success: false, error: "Payment already marked as paid" });
    }

    const paidAt = req.body.paidAt ? parseDateInput(req.body.paidAt) : new Date();
    if (!paidAt) return res.status(400).json({ success: false, error: "Invalid paidAt" });

    let finalAmount = Number(existing.amount);
    const lateFeePercent = Number(existing.feeStructure.lateFeePercent ?? 0);

    if (paidAt > existing.dueDate && lateFeePercent > 0 && existing.status !== "overdue") {
      finalAmount = toMoney(finalAmount + (finalAmount * lateFeePercent) / 100);
    }

    const data = await prisma.feePayment.update({
      where: { id: req.params.id },
      data: {
        amount: finalAmount,
        status: "paid",
        paidAt,
        paymentMethod: req.body.paymentMethod,
        paymentReference: req.body.paymentReference,
        notes: req.body.notes,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        feeStructure: { select: { id: true, name: true, lateFeePercent: true, discountPercent: true } },
      },
    });

    res.json({ success: true, data });
  }
);

// GET /api/finance/student/:studentId
financeRouter.get(
  "/student/:studentId",
  requireRoles("superadmin", "school_admin", "parent", "student"),
  validateParams(studentIdParam),
  validateQuery(studentFinanceQuery),
  async (req, res) => {
    const access = await ensureStudentAccess(req, req.params.studentId);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });

    const paymentsRaw = await prisma.feePayment.findMany({
      where: { studentId: req.params.studentId },
      include: {
        feeStructure: { select: { id: true, name: true, grade: true, lateFeePercent: true, discountPercent: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    const payments = paymentsRaw.map((p) => ({ ...p, status: effectiveStatus(p.status, p.dueDate) }));
    const totalPaid = toMoney(payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0));
    const totalPending = toMoney(payments.filter((p) => p.status !== "paid").reduce((s, p) => s + Number(p.amount), 0));

    res.json({
      success: true,
      data: {
        student: access.student,
        payments,
        summary: {
          totalDue: toMoney(totalPaid + totalPending),
          totalPaid,
          totalPending,
          overdueCount: payments.filter((p) => p.status === "overdue").length,
        },
      },
    });
  }
);

// GET /api/finance/report/overview
financeRouter.get("/report/overview", requireRoles("superadmin", "school_admin"), async (req, res) => {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const rowsRaw = await prisma.feePayment.findMany({
    where: { student: { schoolId } },
    select: { amount: true, status: true, dueDate: true },
  });

  const rows = rowsRaw.map((r) => ({ ...r, status: effectiveStatus(r.status, r.dueDate) }));
  const totalExpected = toMoney(rows.reduce((s, r) => s + Number(r.amount), 0));
  const totalCollected = toMoney(rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0));
  const totalPending = toMoney(rows.filter((r) => r.status !== "paid").reduce((s, r) => s + Number(r.amount), 0));
  const totalOverdue = toMoney(rows.filter((r) => r.status === "overdue").reduce((s, r) => s + Number(r.amount), 0));

  res.json({
    success: true,
    data: {
      totalExpected,
      totalCollected,
      totalPending,
      totalOverdue,
      overdueCount: rows.filter((r) => r.status === "overdue").length,
    },
  });
});

// GET /api/finance/report/grade/:grade
financeRouter.get(
  "/report/grade/:grade",
  requireRoles("superadmin", "school_admin"),
  validateParams(gradeParam),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const grade = Number(req.params.grade);
    const rowsRaw = await prisma.feePayment.findMany({
      where: { student: { schoolId, grade } },
      include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    const items = rowsRaw.map((r) => ({ ...r, status: effectiveStatus(r.status, r.dueDate) }));
    const totalExpected = toMoney(items.reduce((s, r) => s + Number(r.amount), 0));
    const totalCollected = toMoney(items.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0));
    const totalPending = toMoney(items.filter((r) => r.status !== "paid").reduce((s, r) => s + Number(r.amount), 0));
    const totalOverdue = toMoney(items.filter((r) => r.status === "overdue").reduce((s, r) => s + Number(r.amount), 0));

    res.json({
      success: true,
      data: {
        summary: {
          grade,
          paymentCount: items.length,
          totalExpected,
          totalCollected,
          totalPending,
          totalOverdue,
          overdueCount: items.filter((r) => r.status === "overdue").length,
        },
        items,
      },
    });
  }
);
