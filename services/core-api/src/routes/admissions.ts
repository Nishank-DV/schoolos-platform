import { AdmissionStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { createUserPasswordSchema, paginationSchema } from "shared-utils";
import { prisma } from "../lib/prisma.js";
import { auditLog } from "../middleware/audit.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";

const admissionsRouter = Router();

const idParam = z.object({ id: z.string().cuid() });
const documentParam = z.object({ id: z.string().cuid(), documentId: z.string().cuid() });

const listQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(AdmissionStatus).optional(),
  desiredGrade: z.string().min(1).optional(),
  schoolId: z.string().cuid().optional(),
});

const createApplicationSchema = z.object({
  schoolId: z.string().cuid().optional(),
  enquiryId: z.string().cuid().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  desiredGrade: z.string().min(1),
  desiredSection: z.string().optional(),
  source: z.string().optional(),
});

const updateApplicationSchema = z.object({
  enquiryId: z.string().cuid().optional().nullable(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  desiredGrade: z.string().min(1).optional(),
  desiredSection: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
});

const changeStageSchema = z.object({
  toStatus: z.nativeEnum(AdmissionStatus),
  note: z.string().max(2000).optional(),
});

const createDocumentSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  fileUrl: z.string().url().optional().or(z.literal("")),
  status: z.string().min(1).optional(),
});

const updateDocumentSchema = z.object({
  type: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  fileUrl: z.string().url().optional().or(z.literal("")),
  status: z.string().min(1).optional(),
});

const createNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});

const convertToStudentSchema = z.object({
  admissionNumber: z.string().min(1),
  grade: z.number().int().min(1).max(12).optional(),
  section: z.string().optional(),
  parentId: z.string().cuid().optional().nullable(),
  classId: z.string().cuid().optional().nullable(),
  createUser: z.boolean().default(false),
  userEmail: z.string().email().optional(),
  userPassword: createUserPasswordSchema.optional(),
});

const allowedTransitions: Record<AdmissionStatus, AdmissionStatus[]> = {
  draft: [AdmissionStatus.submitted, AdmissionStatus.withdrawn],
  submitted: [AdmissionStatus.under_review, AdmissionStatus.withdrawn],
  under_review: [AdmissionStatus.documents_pending, AdmissionStatus.documents_verified, AdmissionStatus.offered, AdmissionStatus.rejected, AdmissionStatus.withdrawn],
  documents_pending: [AdmissionStatus.documents_verified, AdmissionStatus.under_review, AdmissionStatus.rejected, AdmissionStatus.withdrawn],
  documents_verified: [AdmissionStatus.offered, AdmissionStatus.under_review, AdmissionStatus.rejected, AdmissionStatus.withdrawn],
  offered: [AdmissionStatus.admitted, AdmissionStatus.rejected, AdmissionStatus.withdrawn],
  admitted: [],
  rejected: [],
  withdrawn: [],
};

admissionsRouter.use(authMiddleware);
admissionsRouter.use(requireRoles("school_admin", "superadmin"));

function getScopedSchoolId(req: import("express").Request, inputSchoolId?: string) {
  if (req.user!.role === Role.superadmin) return inputSchoolId;
  return req.user!.schoolId;
}

function scopedWhere(req: import("express").Request, id?: string) {
  if (req.user!.role === Role.superadmin) {
    return {
      ...(id ? { id } : {}),
      ...(req.query.schoolId ? { schoolId: String(req.query.schoolId) } : {}),
    };
  }
  return { ...(id ? { id } : {}), schoolId: req.user!.schoolId! };
}

function getTransitionUpdate(toStatus: AdmissionStatus) {
  const now = new Date();
  const data: Record<string, Date | AdmissionStatus> = { status: toStatus };
  if (toStatus === AdmissionStatus.under_review) data.reviewedAt = now;
  if (toStatus === AdmissionStatus.admitted) data.admittedAt = now;
  if (toStatus === AdmissionStatus.rejected) data.rejectedAt = now;
  return data;
}

admissionsRouter.get("/", validateQuery(listQuerySchema), async (req, res) => {
  const { page, pageSize, status, desiredGrade } = req.query as unknown as {
    page: number;
    pageSize: number;
    status?: AdmissionStatus;
    desiredGrade?: string;
  };
  const where: Record<string, unknown> = scopedWhere(req);
  if (status) where.status = status;
  if (desiredGrade) where.desiredGrade = desiredGrade;
  const [items, total] = await Promise.all([
    prisma.admissionApplication.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        enquiry: { select: { id: true, name: true, email: true, status: true } },
        student: { select: { id: true, admissionNumber: true, firstName: true, lastName: true, grade: true } },
        _count: { select: { documents: true, notes: true, stageHistory: true } },
      },
    }),
    prisma.admissionApplication.count({ where }),
  ]);
  res.json({
    success: true,
    data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
});

admissionsRouter.post(
  "/",
  auditLog("admission.create", "AdmissionApplication", (req) => req.body?.enquiryId ?? null),
  validateBody(createApplicationSchema),
  async (req, res) => {
    const schoolId = getScopedSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    if (req.body.enquiryId) {
      const enquiry = await prisma.enquiry.findFirst({ where: { id: req.body.enquiryId, schoolId } });
      if (!enquiry) return res.status(400).json({ success: false, error: "Enquiry not found for school" });
    }

    const application = await prisma.admissionApplication.create({
      data: {
        schoolId,
        enquiryId: req.body.enquiryId || null,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email || null,
        phone: req.body.phone || null,
        dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null,
        desiredGrade: req.body.desiredGrade,
        desiredSection: req.body.desiredSection || null,
        source: req.body.source || null,
      },
      include: {
        enquiry: true,
        student: true,
      },
    });
    res.status(201).json({ success: true, data: application });
  }
);

admissionsRouter.get("/:id", validateParams(idParam), async (req, res) => {
  const application = await prisma.admissionApplication.findFirst({
    where: scopedWhere(req, req.params.id),
    include: {
      school: { select: { id: true, name: true } },
      enquiry: true,
      student: { select: { id: true, admissionNumber: true, firstName: true, lastName: true, grade: true, section: true, status: true } },
      documents: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      stageHistory: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!application) return res.status(404).json({ success: false, error: "Admission application not found" });
  res.json({ success: true, data: application });
});

admissionsRouter.patch(
  "/:id",
  auditLog("admission.update", "AdmissionApplication", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updateApplicationSchema),
  async (req, res) => {
    const existing = await prisma.admissionApplication.findFirst({ where: scopedWhere(req, req.params.id) });
    if (!existing) return res.status(404).json({ success: false, error: "Admission application not found" });
    if (req.body.enquiryId) {
      const enquiry = await prisma.enquiry.findFirst({ where: { id: req.body.enquiryId, schoolId: existing.schoolId } });
      if (!enquiry) return res.status(400).json({ success: false, error: "Enquiry not found for school" });
    }
    const application = await prisma.admissionApplication.update({
      where: { id: req.params.id },
      data: {
        enquiryId: req.body.enquiryId === undefined ? undefined : req.body.enquiryId,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email === undefined ? undefined : req.body.email,
        phone: req.body.phone === undefined ? undefined : req.body.phone,
        dateOfBirth: req.body.dateOfBirth === undefined ? undefined : req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null,
        desiredGrade: req.body.desiredGrade,
        desiredSection: req.body.desiredSection === undefined ? undefined : req.body.desiredSection,
        source: req.body.source === undefined ? undefined : req.body.source,
      },
    });
    res.json({ success: true, data: application });
  }
);

admissionsRouter.post(
  "/:id/submit",
  auditLog("admission.submit", "AdmissionApplication", (req) => req.params.id),
  validateParams(idParam),
  async (req, res) => {
    const existing = await prisma.admissionApplication.findFirst({ where: scopedWhere(req, req.params.id) });
    if (!existing) return res.status(404).json({ success: false, error: "Admission application not found" });
    if (existing.status !== AdmissionStatus.draft) {
      return res.status(400).json({ success: false, error: "Only draft applications can be submitted" });
    }
    const now = new Date();
    const [, history] = await prisma.$transaction([
      prisma.admissionApplication.update({
        where: { id: existing.id },
        data: { status: AdmissionStatus.submitted, submittedAt: now },
      }),
      prisma.admissionStageHistory.create({
        data: {
          applicationId: existing.id,
          fromStatus: existing.status,
          toStatus: AdmissionStatus.submitted,
          changedByUserId: req.user!.sub,
          note: "Application submitted",
        },
      }),
    ]);
    res.json({ success: true, data: history });
  }
);

admissionsRouter.post(
  "/:id/change-stage",
  auditLog("admission.stage_change", "AdmissionApplication", (req) => req.params.id),
  validateParams(idParam),
  validateBody(changeStageSchema),
  async (req, res) => {
    const existing = await prisma.admissionApplication.findFirst({ where: scopedWhere(req, req.params.id) });
    if (!existing) return res.status(404).json({ success: false, error: "Admission application not found" });
    if (req.body.toStatus === AdmissionStatus.submitted) {
      return res.status(400).json({ success: false, error: "Use submit endpoint for draft submission" });
    }
    if (req.body.toStatus === existing.status) {
      return res.status(400).json({ success: false, error: "Application is already in that stage" });
    }
    if (!allowedTransitions[existing.status].includes(req.body.toStatus)) {
      return res.status(400).json({ success: false, error: `Invalid stage transition from ${existing.status} to ${req.body.toStatus}` });
    }
    const [application, history] = await prisma.$transaction([
      prisma.admissionApplication.update({
        where: { id: existing.id },
        data: getTransitionUpdate(req.body.toStatus),
      }),
      prisma.admissionStageHistory.create({
        data: {
          applicationId: existing.id,
          fromStatus: existing.status,
          toStatus: req.body.toStatus,
          changedByUserId: req.user!.sub,
          note: req.body.note,
        },
      }),
    ]);
    res.json({ success: true, data: { application, history } });
  }
);

admissionsRouter.post(
  "/:id/documents",
  auditLog("admission.document_create", "AdmissionApplication", (req) => req.params.id),
  validateParams(idParam),
  validateBody(createDocumentSchema),
  async (req, res) => {
    const existing = await prisma.admissionApplication.findFirst({ where: scopedWhere(req, req.params.id) });
    if (!existing) return res.status(404).json({ success: false, error: "Admission application not found" });
    const document = await prisma.admissionDocument.create({
      data: {
        applicationId: existing.id,
        type: req.body.type,
        title: req.body.title,
        fileUrl: req.body.fileUrl || null,
        status: req.body.status || "pending",
      },
    });
    res.status(201).json({ success: true, data: document });
  }
);

admissionsRouter.patch(
  "/:id/documents/:documentId",
  auditLog("admission.document_update", "AdmissionDocument", (req) => req.params.documentId),
  validateParams(documentParam),
  validateBody(updateDocumentSchema),
  async (req, res) => {
    const existing = await prisma.admissionApplication.findFirst({ where: scopedWhere(req, req.params.id) });
    if (!existing) return res.status(404).json({ success: false, error: "Admission application not found" });
    const document = await prisma.admissionDocument.findFirst({
      where: { id: req.params.documentId, applicationId: existing.id },
    });
    if (!document) return res.status(404).json({ success: false, error: "Admission document not found" });
    const nextStatus = req.body.status;
    const updated = await prisma.admissionDocument.update({
      where: { id: document.id },
      data: {
        type: req.body.type,
        title: req.body.title,
        fileUrl: req.body.fileUrl === undefined ? undefined : req.body.fileUrl || null,
        status: nextStatus,
        verifiedByUserId: nextStatus === "verified" ? req.user!.sub : nextStatus ? null : undefined,
        verifiedAt: nextStatus === "verified" ? new Date() : nextStatus ? null : undefined,
      },
    });
    res.json({ success: true, data: updated });
  }
);

admissionsRouter.post(
  "/:id/notes",
  auditLog("admission.note_create", "AdmissionApplication", (req) => req.params.id),
  validateParams(idParam),
  validateBody(createNoteSchema),
  async (req, res) => {
    const existing = await prisma.admissionApplication.findFirst({ where: scopedWhere(req, req.params.id) });
    if (!existing) return res.status(404).json({ success: false, error: "Admission application not found" });
    const note = await prisma.admissionNote.create({
      data: {
        applicationId: existing.id,
        authorUserId: req.user!.sub,
        body: req.body.body,
      },
    });
    res.status(201).json({ success: true, data: note });
  }
);

admissionsRouter.post(
  "/:id/convert-to-student",
  auditLog("admission.convert_to_student", "AdmissionApplication", (req) => req.params.id),
  validateParams(idParam),
  validateBody(convertToStudentSchema),
  async (req, res) => {
    const application = await prisma.admissionApplication.findFirst({
      where: scopedWhere(req, req.params.id),
      include: { enquiry: true },
    });
    if (!application) return res.status(404).json({ success: false, error: "Admission application not found" });
    if (application.status !== AdmissionStatus.admitted) {
      return res.status(400).json({ success: false, error: "Only admitted applications can be converted to students" });
    }
    if (application.studentId) {
      return res.status(400).json({ success: false, error: "Application is already linked to a student" });
    }

    const grade = req.body.grade ?? Number(application.desiredGrade);
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
      return res.status(400).json({ success: false, error: "A valid numeric grade is required for enrollment" });
    }

    const emailForLogin = req.body.userEmail ?? application.email ?? undefined;
    if (req.body.createUser && (!emailForLogin || !req.body.userPassword)) {
      return res.status(400).json({ success: false, error: "userEmail and userPassword are required when createUser is true" });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (req.body.parentId) {
        const parent = await tx.parent.findFirst({ where: { id: req.body.parentId, schoolId: application.schoolId } });
        if (!parent) throw new Error("Parent not found for school");
      }
      if (req.body.classId) {
        const classEntity = await tx.class.findFirst({ where: { id: req.body.classId, schoolId: application.schoolId } });
        if (!classEntity) throw new Error("Class not found for school");
      }
      if (req.body.createUser && emailForLogin) {
        const existingUser = await tx.user.findUnique({ where: { email: emailForLogin } });
        if (existingUser) throw new Error("Email already registered");
      }

      const student = await tx.student.create({
        data: {
          schoolId: application.schoolId,
          admissionNumber: req.body.admissionNumber,
          firstName: application.firstName,
          lastName: application.lastName,
          dateOfBirth: application.dateOfBirth,
          grade,
          section: req.body.section ?? application.desiredSection ?? null,
          parentId: req.body.parentId ?? null,
          classId: req.body.classId ?? null,
          status: "active",
        },
      });

      let createdUser: { id: string; email: string; role: Role } | null = null;
      if (req.body.createUser && emailForLogin && req.body.userPassword) {
        const passwordHash = await bcrypt.hash(req.body.userPassword, 10);
        createdUser = await tx.user.create({
          data: {
            email: emailForLogin,
            passwordHash,
            role: Role.student,
            schoolId: application.schoolId,
            studentId: student.id,
          },
          select: { id: true, email: true, role: true },
        });
      }

      const updatedApplication = await tx.admissionApplication.update({
        where: { id: application.id },
        data: {
          studentId: student.id,
          status: AdmissionStatus.admitted,
          admittedAt: application.admittedAt ?? new Date(),
        },
      });

      if (application.enquiryId) {
        await tx.enquiry.update({
          where: { id: application.enquiryId },
          data: { status: "admitted" },
        });
      }

      return { student, user: createdUser, application: updatedApplication };
    });

    res.status(201).json({ success: true, data: result });
  }
);

export default admissionsRouter;