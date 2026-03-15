import { StudentAttendanceStatus, TeacherAttendanceStatus } from "@prisma/client";
import { Router } from "express";
import { paginationSchema } from "shared-utils";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { auditLog } from "../middleware/audit.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";

const idParam = z.object({ id: z.string().cuid() });
const studentIdParam = z.object({ studentId: z.string().cuid() });
const classIdParam = z.object({ classId: z.string().min(1) });

const sessionQuery = paginationSchema.extend({
  schoolId: z.string().cuid().optional(),
  classId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
  academicYearId: z.string().min(1).optional(),
  date: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const createSessionSchema = z.object({
  schoolId: z.string().cuid().optional(),
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  academicYearId: z.string().min(1),
  date: z.string(),
});

const markAttendanceSchema = z.object({
  schoolId: z.string().cuid().optional(),
  sessionId: z.string().cuid(),
  studentId: z.string().cuid(),
  status: z.nativeEnum(StudentAttendanceStatus),
  remarks: z.string().optional(),
});

const updateMarkSchema = z.object({
  status: z.nativeEnum(StudentAttendanceStatus).optional(),
  remarks: z.string().optional().nullable(),
});

const teacherAttendanceListQuery = paginationSchema.extend({
  schoolId: z.string().cuid().optional(),
  teacherId: z.string().min(1).optional(),
  date: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const teacherAttendanceCreateSchema = z.object({
  schoolId: z.string().cuid().optional(),
  teacherId: z.string().min(1),
  date: z.string(),
  status: z.nativeEnum(TeacherAttendanceStatus),
  remarks: z.string().optional(),
});

const teacherAttendanceUpdateSchema = z.object({
  status: z.nativeEnum(TeacherAttendanceStatus).optional(),
  remarks: z.string().optional().nullable(),
});

const studentReportQuery = z.object({
  schoolId: z.string().cuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const classReportQuery = z.object({
  schoolId: z.string().cuid().optional(),
  sectionId: z.string().min(1).optional(),
  academicYearId: z.string().min(1).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const attendanceRouter = Router();
attendanceRouter.use(authMiddleware);

function getSchoolId(req: import("express").Request, input?: string) {
  if (req.user!.role === "superadmin") return input ?? (req.query.schoolId as string | undefined);
  return req.user!.schoolId;
}

function parseDateOrNull(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function normalizeDate(value: string) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

attendanceRouter.get("/sessions", requireRoles("superadmin", "school_admin", "teacher"), validateQuery(sessionQuery), async (req, res) => {
  const { page, pageSize, classId, sectionId, academicYearId, date, from, to } = req.query as unknown as {
    page: number;
    pageSize: number;
    classId?: string;
    sectionId?: string;
    academicYearId?: string;
    date?: string;
    from?: string;
    to?: string;
  };
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const where: {
    schoolId: string;
    classId?: string;
    sectionId?: string;
    academicYearId?: string;
    date?: Date | { gte?: Date; lte?: Date };
  } = { schoolId };
  if (classId) where.classId = classId;
  if (sectionId) where.sectionId = sectionId;
  if (academicYearId) where.academicYearId = academicYearId;

  if (date) {
    const parsed = parseDateOrNull(date);
    if (!parsed) return res.status(400).json({ success: false, error: "Invalid date" });
    where.date = parsed;
  }
  if (from || to) {
    const gte = parseDateOrNull(from);
    const lte = parseDateOrNull(to);
    if ((from && !gte) || (to && !lte)) return res.status(400).json({ success: false, error: "Invalid from/to date" });
    where.date = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
  }

  const [items, total] = await Promise.all([
    prisma.attendanceSession.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { date: "desc" },
      include: {
        class: { select: { id: true, name: true, grade: true } },
        section: { select: { id: true, name: true, capacity: true } },
        academicYear: { select: { id: true, name: true, isActive: true } },
        _count: { select: { records: true } },
      },
    }),
    prisma.attendanceSession.count({ where }),
  ]);

  res.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
});

attendanceRouter.post(
  "/sessions",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("attendance.session.create", "AttendanceSession", (req) => req.body?.classId ?? null),
  validateBody(createSessionSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const [classEntity, section, year] = await Promise.all([
      prisma.class.findFirst({ where: { id: req.body.classId, schoolId } }),
      prisma.section.findFirst({ where: { id: req.body.sectionId, schoolId } }),
      prisma.academicYear.findFirst({ where: { id: req.body.academicYearId, schoolId } }),
    ]);

    if (!classEntity) return res.status(400).json({ success: false, error: "Class not found for school" });
    if (!section) return res.status(400).json({ success: false, error: "Section not found for school" });
    if (section.classId !== classEntity.id) return res.status(400).json({ success: false, error: "Section does not belong to class" });
    if (!year) return res.status(400).json({ success: false, error: "Academic year not found for school" });

    const sessionDate = normalizeDate(req.body.date);
    const session = await prisma.attendanceSession.upsert({
      where: {
        classId_sectionId_academicYearId_date: {
          classId: req.body.classId,
          sectionId: req.body.sectionId,
          academicYearId: req.body.academicYearId,
          date: sessionDate,
        },
      },
      update: {},
      create: {
        schoolId,
        classId: req.body.classId,
        sectionId: req.body.sectionId,
        academicYearId: req.body.academicYearId,
        date: sessionDate,
      },
      include: {
        class: { select: { id: true, name: true, grade: true } },
        section: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ success: true, data: session });
  }
);

attendanceRouter.get("/sessions/:id", requireRoles("superadmin", "school_admin", "teacher"), validateParams(idParam), async (req, res) => {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const session = await prisma.attendanceSession.findFirst({
    where: { id: req.params.id, schoolId },
    include: {
      class: { select: { id: true, name: true, grade: true } },
      section: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true, isActive: true } },
      records: {
        orderBy: { student: { admissionNumber: "asc" } },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, grade: true } },
        },
      },
    },
  });

  if (!session) return res.status(404).json({ success: false, error: "Attendance session not found" });
  res.json({ success: true, data: session });
});

attendanceRouter.post(
  "/mark",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("attendance.record.create", "AttendanceRecord", (req) => req.body?.studentId ?? null),
  validateBody(markAttendanceSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const [session, student] = await Promise.all([
      prisma.attendanceSession.findFirst({ where: { id: req.body.sessionId, schoolId } }),
      prisma.student.findFirst({ where: { id: req.body.studentId, schoolId } }),
    ]);

    if (!session) return res.status(400).json({ success: false, error: "Attendance session not found for school" });
    if (!student) return res.status(400).json({ success: false, error: "Student not found for school" });

    const item = await prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: req.body.sessionId, studentId: req.body.studentId } },
      update: { status: req.body.status, remarks: req.body.remarks },
      create: {
        schoolId,
        sessionId: req.body.sessionId,
        studentId: req.body.studentId,
        status: req.body.status,
        remarks: req.body.remarks,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        session: { select: { id: true, date: true } },
      },
    });

    res.status(201).json({ success: true, data: item });
  }
);

attendanceRouter.patch(
  "/mark/:id",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("attendance.record.update", "AttendanceRecord", (req) => req.params.id),
  validateParams(idParam),
  validateBody(updateMarkSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.attendanceRecord.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Attendance record not found" });

    const item = await prisma.attendanceRecord.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        remarks: req.body.remarks === undefined ? undefined : req.body.remarks,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        session: { select: { id: true, date: true } },
      },
    });

    res.json({ success: true, data: item });
  }
);

attendanceRouter.get("/report/student/:studentId", requireRoles("superadmin", "school_admin", "teacher", "parent", "student"), validateParams(studentIdParam), validateQuery(studentReportQuery), async (req, res) => {
  const studentId = req.params.studentId;
  const user = req.user!;

  const student = await prisma.student.findFirst({ where: { id: studentId }, select: { id: true, schoolId: true, parentId: true } });
  if (!student) return res.status(404).json({ success: false, error: "Student not found" });

  if (user.role === "parent" && user.parentId !== student.parentId) return res.status(403).json({ success: false, error: "Forbidden" });
  if (user.role === "student" && user.studentId !== student.id) return res.status(403).json({ success: false, error: "Forbidden" });
  if ((user.role === "school_admin" || user.role === "teacher") && user.schoolId !== student.schoolId) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  const schoolId = user.role === "superadmin" ? (req.query.schoolId ? String(req.query.schoolId) : student.schoolId) : user.schoolId;
  if (!schoolId || schoolId !== student.schoolId) return res.status(403).json({ success: false, error: "School access denied" });

  const from = parseDateOrNull(req.query.from as string | undefined);
  const to = parseDateOrNull(req.query.to as string | undefined);
  if ((req.query.from && !from) || (req.query.to && !to)) return res.status(400).json({ success: false, error: "Invalid from/to date" });

  const where: {
    schoolId: string;
    studentId: string;
    session?: { date?: { gte?: Date; lte?: Date } };
  } = { schoolId, studentId };
  if (from || to) {
    where.session = { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    orderBy: { session: { date: "desc" } },
    include: {
      session: {
        select: {
          id: true,
          date: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, grade: true } },
    },
  });

  const total = records.length;
  const present = records.filter((r) => r.status === StudentAttendanceStatus.Present).length;
  const absent = records.filter((r) => r.status === StudentAttendanceStatus.Absent).length;
  const late = records.filter((r) => r.status === StudentAttendanceStatus.Late).length;
  const attendancePct = total ? Math.round((present / total) * 1000) / 10 : 0;

  const byMonth: Record<string, { present: number; absent: number; late: number; total: number }> = {};
  for (const r of records) {
    const key = r.session.date.toISOString().slice(0, 7);
    if (!byMonth[key]) byMonth[key] = { present: 0, absent: 0, late: 0, total: 0 };
    byMonth[key].total += 1;
    if (r.status === StudentAttendanceStatus.Present) byMonth[key].present += 1;
    if (r.status === StudentAttendanceStatus.Absent) byMonth[key].absent += 1;
    if (r.status === StudentAttendanceStatus.Late) byMonth[key].late += 1;
  }

  res.json({
    success: true,
    data: {
      student: records[0]?.student,
      summary: { total, present, absent, late, attendancePercent: attendancePct },
      monthly: Object.entries(byMonth)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, value]) => ({ month, ...value, attendancePercent: value.total ? Math.round((value.present / value.total) * 1000) / 10 : 0 })),
      records,
    },
  });
});

attendanceRouter.get("/report/class/:classId", requireRoles("superadmin", "school_admin", "teacher"), validateParams(classIdParam), validateQuery(classReportQuery), async (req, res) => {
  const classId = req.params.classId;
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const classEntity = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!classEntity) return res.status(404).json({ success: false, error: "Class not found" });

  const from = parseDateOrNull(req.query.from as string | undefined);
  const to = parseDateOrNull(req.query.to as string | undefined);
  if ((req.query.from && !from) || (req.query.to && !to)) return res.status(400).json({ success: false, error: "Invalid from/to date" });

  const where: {
    schoolId: string;
    classId: string;
    sectionId?: string;
    academicYearId?: string;
    date?: { gte?: Date; lte?: Date };
  } = { schoolId, classId };
  if (req.query.sectionId) where.sectionId = String(req.query.sectionId);
  if (req.query.academicYearId) where.academicYearId = String(req.query.academicYearId);
  if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const sessions = await prisma.attendanceSession.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      section: { select: { id: true, name: true } },
      records: {
        select: { status: true, studentId: true },
      },
    },
  });

  let present = 0;
  let absent = 0;
  let late = 0;
  const studentSummary: Record<string, { present: number; absent: number; late: number; total: number }> = {};
  for (const s of sessions) {
    for (const r of s.records) {
      if (!studentSummary[r.studentId]) studentSummary[r.studentId] = { present: 0, absent: 0, late: 0, total: 0 };
      studentSummary[r.studentId].total += 1;
      if (r.status === StudentAttendanceStatus.Present) {
        present += 1;
        studentSummary[r.studentId].present += 1;
      }
      if (r.status === StudentAttendanceStatus.Absent) {
        absent += 1;
        studentSummary[r.studentId].absent += 1;
      }
      if (r.status === StudentAttendanceStatus.Late) {
        late += 1;
        studentSummary[r.studentId].late += 1;
      }
    }
  }

  const totalRecords = present + absent + late;
  const students = await prisma.student.findMany({ where: { id: { in: Object.keys(studentSummary) } }, select: { id: true, firstName: true, lastName: true, admissionNumber: true } });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  res.json({
    success: true,
    data: {
      classId,
      totalSessions: sessions.length,
      summary: {
        totalRecords,
        present,
        absent,
        late,
        attendancePercent: totalRecords ? Math.round((present / totalRecords) * 1000) / 10 : 0,
      },
      students: Object.entries(studentSummary)
        .map(([studentId, summary]) => {
          const student = studentMap.get(studentId);
          return {
            studentId,
            admissionNumber: student?.admissionNumber,
            name: student ? `${student.firstName} ${student.lastName}` : studentId,
            ...summary,
            attendancePercent: summary.total ? Math.round((summary.present / summary.total) * 1000) / 10 : 0,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
      sessions,
    },
  });
});

attendanceRouter.get("/teachers", requireRoles("superadmin", "school_admin", "teacher"), validateQuery(teacherAttendanceListQuery), async (req, res) => {
  const { page, pageSize, teacherId, date, from, to } = req.query as unknown as {
    page: number;
    pageSize: number;
    teacherId?: string;
    date?: string;
    from?: string;
    to?: string;
  };
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const where: {
    schoolId: string;
    teacherId?: string;
    date?: Date | { gte?: Date; lte?: Date };
  } = { schoolId };
  if (teacherId) where.teacherId = teacherId;
  if (date) {
    const parsed = parseDateOrNull(date);
    if (!parsed) return res.status(400).json({ success: false, error: "Invalid date" });
    where.date = parsed;
  }
  if (from || to) {
    const gte = parseDateOrNull(from);
    const lte = parseDateOrNull(to);
    if ((from && !gte) || (to && !lte)) return res.status(400).json({ success: false, error: "Invalid from/to date" });
    where.date = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
  }

  const [items, total] = await Promise.all([
    prisma.teacherAttendance.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { date: "desc" },
      include: { teacher: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    prisma.teacherAttendance.count({ where }),
  ]);

  res.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
});

attendanceRouter.post(
  "/teachers",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("attendance.teacher.create", "TeacherAttendance", (req) => req.body?.teacherId ?? null),
  validateBody(teacherAttendanceCreateSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req, req.body.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const teacher = await prisma.teacher.findFirst({ where: { id: req.body.teacherId, schoolId } });
    if (!teacher) return res.status(400).json({ success: false, error: "Teacher not found for school" });

    const date = normalizeDate(req.body.date);
    const item = await prisma.teacherAttendance.upsert({
      where: { teacherId_date: { teacherId: req.body.teacherId, date } },
      update: { status: req.body.status, remarks: req.body.remarks },
      create: {
        schoolId,
        teacherId: req.body.teacherId,
        date,
        status: req.body.status,
        remarks: req.body.remarks,
      },
      include: { teacher: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    res.status(201).json({ success: true, data: item });
  }
);

attendanceRouter.patch(
  "/teachers/:id",
  requireRoles("superadmin", "school_admin", "teacher"),
  auditLog("attendance.teacher.update", "TeacherAttendance", (req) => req.params.id),
  validateParams(idParam),
  validateBody(teacherAttendanceUpdateSchema),
  async (req, res) => {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

    const existing = await prisma.teacherAttendance.findFirst({ where: { id: req.params.id, schoolId } });
    if (!existing) return res.status(404).json({ success: false, error: "Teacher attendance record not found" });

    const item = await prisma.teacherAttendance.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        remarks: req.body.remarks === undefined ? undefined : req.body.remarks,
      },
      include: { teacher: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    res.json({ success: true, data: item });
  }
);

// Legacy compatibility endpoint for existing parent and student screens
attendanceRouter.get("/student/:id", requireRoles("superadmin", "school_admin", "teacher", "parent", "student"), validateParams(idParam), validateQuery(z.object({ from: z.string().optional(), to: z.string().optional(), schoolId: z.string().cuid().optional() })), async (req, res) => {
  const studentId = req.params.id;
  const user = req.user!;

  const student = await prisma.student.findFirst({ where: { id: studentId }, select: { id: true, schoolId: true, parentId: true } });
  if (!student) return res.status(404).json({ success: false, error: "Student not found" });

  if (user.role === "parent" && user.parentId !== student.parentId) return res.status(403).json({ success: false, error: "Forbidden" });
  if (user.role === "student" && user.studentId !== student.id) return res.status(403).json({ success: false, error: "Forbidden" });
  if ((user.role === "school_admin" || user.role === "teacher") && user.schoolId !== student.schoolId) return res.status(403).json({ success: false, error: "Forbidden" });

  const schoolId = user.role === "superadmin" ? (req.query.schoolId ? String(req.query.schoolId) : student.schoolId) : user.schoolId;
  if (!schoolId || schoolId !== student.schoolId) return res.status(403).json({ success: false, error: "School access denied" });

  const from = parseDateOrNull(req.query.from as string | undefined);
  const to = parseDateOrNull(req.query.to as string | undefined);
  const where: { schoolId: string; studentId: string; session?: { date?: { gte?: Date; lte?: Date } } } = { schoolId, studentId };
  if (from || to) where.session = { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };

  const records = await prisma.attendanceRecord.findMany({ where, orderBy: { session: { date: "desc" } }, take: 180, include: { session: { select: { date: true } } } });
  const items = records.map((r) => ({ id: r.id, date: r.session.date, status: r.status.toLowerCase(), remarks: r.remarks }));
  res.json({ success: true, data: items });
});
