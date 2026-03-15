import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { auditLog } from "../middleware/audit.js";
import { paginationSchema } from "shared-utils";
import { z } from "zod";

const idParam = z.object({ id: z.string().min(1) });

export const announcementsRouter = Router();
announcementsRouter.use(authMiddleware);

const priorityEnum = z.enum(["low", "normal", "high"]);
const audienceEnum = z.enum(["all", "students", "parents"]);

const listQuery = paginationSchema.extend({
  schoolId: z.string().min(1).optional(),
  priority: priorityEnum.optional(),
  audience: audienceEnum.optional(),
  isPublished: z.coerce.boolean().optional(),
});

const createAnnouncementSchema = z.object({
  schoolId: z.string().min(1).optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  priority: priorityEnum.optional(),
  audience: audienceEnum.optional(),
  isPublished: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
});

const updateAnnouncementSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  priority: priorityEnum.optional(),
  audience: audienceEnum.optional(),
  isPublished: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
});

function getSchoolId(req: import("express").Request, input?: string) {
  if (req.user!.role === "superadmin") return input ?? (req.query.schoolId as string | undefined);
  return req.user!.schoolId;
}

function parseDateInput(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function buildFeedWhere(schoolId: string, audiences: Array<"all" | "students" | "parents" | "teachers">) {
  return {
    schoolId,
    isPublished: true,
    audience: { in: audiences },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

// GET /api/announcements
announcementsRouter.get(
  "/",
  requireRoles("superadmin", "school_admin"),
  validateQuery(listQuery),
  async (req, res) => {
    const { page, pageSize, priority, audience, isPublished } = req.query as unknown as {
      page: number;
      pageSize: number;
      priority?: "low" | "normal" | "high";
      audience?: "all" | "students" | "parents" | "teachers";
      isPublished?: boolean;
    };

    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const where: Record<string, unknown> = { schoolId };
    if (priority) where.priority = priority;
    if (audience) where.audience = audience;
    if (isPublished !== undefined) where.isPublished = isPublished;

    const [items, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ isPublished: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.announcement.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  }
);

// Additional routes for feed and reporting
// GET /api/announcements/feed/student
announcementsRouter.get("/feed/student", requireRoles("student"), async (req, res) => {
  const schoolId = req.user!.schoolId;
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const items = await prisma.announcement.findMany({
    where: buildFeedWhere(schoolId, ["all", "students"]),
    orderBy: [{ priority: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
  });

  res.json({ success: true, data: items });
});

// GET /api/announcements/feed/parent
announcementsRouter.get("/feed/parent", requireRoles("parent"), async (req, res) => {
  const schoolId = req.user!.schoolId;
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const items = await prisma.announcement.findMany({
    where: buildFeedWhere(schoolId, ["all", "parents"]),
    orderBy: [{ priority: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
  });

  res.json({ success: true, data: items });
});

// GET /api/announcements/feed/admin
announcementsRouter.get("/feed/admin", requireRoles("superadmin", "school_admin"), async (req, res) => {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const items = await prisma.announcement.findMany({
    where: { schoolId },
    orderBy: [{ isPublished: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
  });

  res.json({ success: true, data: items });
});

// GET /api/announcements/report/overview
announcementsRouter.get("/report/overview", requireRoles("superadmin", "school_admin"), async (req, res) => {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const items = await prisma.announcement.findMany({
    where: { schoolId },
    select: { priority: true, audience: true, isPublished: true, expiresAt: true },
  });

  const byPriority = { low: 0, normal: 0, high: 0 };
  const byAudience = { all: 0, students: 0, parents: 0, teachers: 0 };
  let published = 0;
  let draft = 0;
  let expired = 0;

  for (const item of items) {
    if (item.priority in byPriority) byPriority[item.priority as keyof typeof byPriority] += 1;
    if (item.audience in byAudience) byAudience[item.audience as keyof typeof byAudience] += 1;
    if (item.isPublished) published += 1;
    else draft += 1;
    if (item.expiresAt && item.expiresAt <= new Date()) expired += 1;
  }

  res.json({
    success: true,
    data: {
      totalAnnouncements: items.length,
      byPriority,
      byAudience,
      published,
      draft,
      expired,
    },
  });
});

// GET /api/announcements/:id
announcementsRouter.get("/:id", requireRoles("superadmin", "school_admin"), validateParams(idParam), async (req, res) => {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const data = await prisma.announcement.findFirst({
    where: { id: req.params.id, schoolId },
    include: { school: true },
  });

  if (!data) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, data });
});

// POST /api/announcements
announcementsRouter.post(
  "/",
  requireRoles("superadmin", "school_admin"),
  auditLog("announcement.create", "Announcement", (req) => req.body?.title ?? null),
  validateBody(createAnnouncementSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const expiresAt = parseDateInput(req.body.expiresAt);
    if (req.body.expiresAt && !expiresAt) return res.status(400).json({ success: false, error: "Invalid expiresAt" });

    const isPublished = req.body.isPublished ?? false;
    const data = await prisma.announcement.create({
      data: {
        schoolId,
        title: req.body.title,
        body: req.body.body,
        priority: req.body.priority ?? "normal",
        audience: req.body.audience ?? "all",
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        expiresAt,
      },
    });

    res.status(201).json({ success: true, data });
  }
);

// PATCH /api/announcements/:id
announcementsRouter.patch(
  "/:id",
  requireRoles("superadmin", "school_admin"),
  auditLog("announcement.update", "Announcement", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updateAnnouncementSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.announcement.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Not found" });

    const expiresAt = req.body.expiresAt === undefined
      ? undefined
      : req.body.expiresAt === null
        ? null
        : parseDateInput(req.body.expiresAt);

    if (req.body.expiresAt !== undefined && req.body.expiresAt !== null && !expiresAt) {
      return res.status(400).json({ success: false, error: "Invalid expiresAt" });
    }

    const data = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title,
        body: req.body.body,
        priority: req.body.priority,
        audience: req.body.audience,
        isPublished: req.body.isPublished,
        publishedAt: req.body.isPublished === true && !existing.isPublished
          ? new Date()
          : req.body.isPublished === false
            ? null
            : undefined,
        expiresAt,
      },
    });

    res.json({ success: true, data });
  }
);

// DELETE /api/announcements/:id
announcementsRouter.delete(
  "/:id",
  requireRoles("superadmin", "school_admin"),
  auditLog("announcement.delete", "Announcement", (req) => req.params.id),
  validateParams(idParam),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.announcement.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Not found" });

    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  }
);

// POST /api/announcements/:id/publish
announcementsRouter.post(
  "/:id/publish",
  requireRoles("superadmin", "school_admin"),
  auditLog("announcement.publish", "Announcement", (req) => req.params.id),
  validateParams(idParam),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.announcement.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Not found" });

    const data = await prisma.announcement.update({
      where: { id: req.params.id },
      data: { isPublished: true, publishedAt: new Date() },
    });

    res.json({ success: true, data });
  }
);

// POST /api/announcements/:id/unpublish
announcementsRouter.post(
  "/:id/unpublish",
  requireRoles("superadmin", "school_admin"),
  auditLog("announcement.unpublish", "Announcement", (req) => req.params.id),
  validateParams(idParam),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.announcement.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Not found" });

    const data = await prisma.announcement.update({
      where: { id: req.params.id },
      data: { isPublished: false, publishedAt: null },
    });

    res.json({ success: true, data });
  }
);
