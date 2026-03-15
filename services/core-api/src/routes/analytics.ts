import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateParams } from "../middleware/validate.js";
import { getGenAI } from "../lib/genai.js";

const studentIdParam = z.object({ studentId: z.string().min(1) });
const classIdParam = z.object({ classId: z.string().min(1) });

export const analyticsRouter = Router();
analyticsRouter.use(authMiddleware);

function getSchoolId(req: import("express").Request, input?: string) {
  if (req.user!.role === "superadmin") return input ?? (req.query.schoolId as string | undefined);
  return req.user!.schoolId;
}

// ============ DETERMINISTIC ANALYTICS FUNCTIONS ============

async function calculateStudentMetrics(schoolId: string, studentId: string) {
  const [attendance, assignments, grades, quizzes, innovation] = await Promise.all([
    // Attendance rate
    prisma.attendance.findMany({ where: { studentId } }),
    // Assignment completion
    prisma.assignmentSubmission.findMany({
      where: { studentId, schoolId },
      include: { assignment: true },
    }),
    // Average marks
    prisma.grade.findMany({ where: { studentId } }),
    // Quiz performance
    prisma.quizAttempt.findMany({ where: { studentId } }),
    // Innovation activity
    prisma.innovationLog.findMany({ where: { studentId } }),
  ]);

  const presentDays = attendance.filter((a) => a.status === "present" || a.status === "late").length;
  const attendanceRate = attendance.length > 0 ? (presentDays / attendance.length) * 100 : 0;

  const assignmentCompletionRate =
    assignments.length > 0
      ? (assignments.filter((a) => a.submittedAt && a.grade !== null).length / assignments.length) * 100
      : 0;

  const averageMarks =
    grades.length > 0
      ? grades.reduce((sum, g) => sum + (g.marks / g.maxMarks) * 100, 0) / grades.length
      : 0;

  const quizAverage =
    quizzes.length > 0
      ? quizzes
          .filter((q) => q.score !== null && q.maxMarks !== null)
          .reduce((sum, q) => sum + (Number(q.score) / Number(q.maxMarks)) * 100, 0) /
        quizzes.filter((q) => q.score !== null).length
      : 0;

  const innovationScore = innovation.length;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (averageMarks >= 80) strengths.push("Strong exam performance");
  else if (averageMarks < 50) weaknesses.push("Low exam scores");

  if (attendanceRate >= 90) strengths.push("Excellent attendance");
  else if (attendanceRate < 75) weaknesses.push("Poor attendance");

  if (assignmentCompletionRate >= 90) strengths.push("Consistent with submissions");
  else if (assignmentCompletionRate < 50) weaknesses.push("Missing assignments");

  if (quizAverage >= 75) strengths.push("Good quiz performance");
  if (innovationScore > 0) strengths.push("Active in innovation labs");

  return {
    attendanceRate: Math.round(attendanceRate * 10) / 10,
    assignmentCompletionRate: Math.round(assignmentCompletionRate * 10) / 10,
    averageExamScore: Math.round(averageMarks * 10) / 10,
    quizScoreAverage: Math.round(quizAverage * 10) / 10,
    innovationActivityScore: innovationScore,
    strengths: strengths.length > 0 ? strengths : ["Ready to improve"],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Performing well"],
  };
}

async function detectAcademicRisk(schoolId: string, studentId: string) {
  const metrics = await calculateStudentMetrics(schoolId, studentId);

  let riskLevel = "LOW";
  if (
    metrics.attendanceRate < 75 ||
    metrics.averageExamScore < 50 ||
    metrics.assignmentCompletionRate < 50
  ) {
    riskLevel = "HIGH";
  } else if (
    metrics.attendanceRate < 85 ||
    metrics.averageExamScore < 65 ||
    metrics.assignmentCompletionRate < 70
  ) {
    riskLevel = "MEDIUM";
  }

  return { riskLevel, metrics };
}

async function getClassMetrics(schoolId: string, classId: string) {
  const students = await prisma.student.findMany({
    where: { schoolId, classId, status: "active" },
    select: { id: true, firstName: true, lastName: true },
  });

  const studentMetrics = await Promise.all(
    students.map(async (s) => {
      const m = await calculateStudentMetrics(schoolId, s.id);
      return { studentId: s.id, name: `${s.firstName} ${s.lastName}`, ...m };
    })
  );

  const classAverageScore = studentMetrics.length
    ? studentMetrics.reduce((sum, s) => sum + s.averageExamScore, 0) / studentMetrics.length
    : 0;

  const attendanceAverage = studentMetrics.length
    ? studentMetrics.reduce((sum, s) => sum + s.attendanceRate, 0) / studentMetrics.length
    : 0;

  const assignmentCompletionAverage = studentMetrics.length
    ? studentMetrics.reduce((sum, s) => sum + s.assignmentCompletionRate, 0) / studentMetrics.length
    : 0;

  const quizAverage = studentMetrics.length
    ? studentMetrics.reduce((sum, s) => sum + s.quizScoreAverage, 0) / studentMetrics.length
    : 0;

  const topPerformers = studentMetrics.sort((a, b) => b.averageExamScore - a.averageExamScore).slice(0, 5);
  const atRiskStudents = studentMetrics.filter((s) => {
    const risk = s.averageExamScore < 50 || s.attendanceRate < 75 || s.assignmentCompletionRate < 50;
    return risk;
  });

  return {
    classAverageScore: Math.round(classAverageScore * 10) / 10,
    attendanceAverage: Math.round(attendanceAverage * 10) / 10,
    assignmentCompletionAverage: Math.round(assignmentCompletionAverage * 10) / 10,
    quizAverage: Math.round(quizAverage * 10) / 10,
    topPerformers,
    atRiskStudents,
  };
}

// ============ STUDENT ANALYTICS ENDPOINTS ============

// GET /api/analytics/student/:studentId
analyticsRouter.get("/student/:studentId", requireRoles("student", "parent", "superadmin", "school_admin"), validateParams(studentIdParam), async (req, res) => {
  const { studentId } = req.params;
  const schoolId = getSchoolId(req);

  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  // Verify access: students can only view own, parents can only view children
  if (req.user!.role === "student" && req.user!.studentId !== studentId) {
    return res.status(403).json({ success: false, error: "Cannot access other student data" });
  }
  if (req.user!.role === "parent" && req.user!.parentId) {
    const link = await prisma.student.findFirst({
      where: { id: studentId, parentId: req.user!.parentId },
    });
    if (!link) return res.status(403).json({ success: false, error: "Not your child" });
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
  });
  if (!student) return res.status(404).json({ success: false, error: "Student not found" });

  const metrics = await calculateStudentMetrics(schoolId, studentId);
  const risk = await detectAcademicRisk(schoolId, studentId);

  // Optional AI insights
  let aiInsights = "";
  try {
    const genai = getGenAI();
    aiInsights = await genai.generateLearningInsights(
      studentId,
      [
        { subject: "Overall", score: metrics.averageExamScore },
        { subject: "Attendance", score: metrics.attendanceRate },
      ]
    );
  } catch (e) {
    // Fallback: AI unavailable
  }

  res.json({
    success: true,
    data: {
      studentId,
      ...metrics,
      riskLevel: risk.riskLevel,
      aiInsights: aiInsights || "Focus on consistent attendance and assignment completion.",
    },
  });
});

// ============ CLASS ANALYTICS ENDPOINTS ============

// GET /api/analytics/class/:classId
analyticsRouter.get("/class/:classId", requireRoles("superadmin", "school_admin", "teacher"), validateParams(classIdParam), async (req, res) => {
  const { classId } = req.params;
  const schoolId = getSchoolId(req);

  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  const classData = await prisma.class.findFirst({
    where: { id: classId, schoolId },
  });
  if (!classData) return res.status(404).json({ success: false, error: "Class not found" });

  const classMetrics = await getClassMetrics(schoolId, classId);

  res.json({
    success: true,
    data: classMetrics,
  });
});

// ============ SCHOOL OVERVIEW ENDPOINTS ============

// GET /api/analytics/school/overview
analyticsRouter.get("/school/overview", requireRoles("superadmin", "school_admin"), async (req, res) => {
  const schoolId = getSchoolId(req);

  if (!schoolId) {
    return res.json({
      success: true,
      data: {
        totalStudents: 0,
        averageAttendance: 0,
        averageScore: 0,
        assignmentCompletionRate: 0,
        innovationParticipationRate: 0,
      },
    });
  }

  const [students, attendance, grades, submissions, innovation] = await Promise.all([
    prisma.student.findMany({ where: { schoolId, status: "active" }, select: { id: true } }),
    prisma.attendance.findMany({
      where: { student: { schoolId } },
      select: { status: true },
    }),
    prisma.grade.findMany({
      where: { student: { schoolId } },
      select: { marks: true, maxMarks: true },
      take: 10000,
    }),
    prisma.assignmentSubmission.findMany({
      where: { schoolId },
      select: { grade: true },
    }),
    prisma.innovationLog.findMany({
      where: { student: { schoolId } },
    }),
  ]);

  const totalStudents = students.length;

  const presentDays = attendance.filter((a) => a.status === "present" || a.status === "late").length;
  const averageAttendance = attendance.length > 0 ? (presentDays / attendance.length) * 100 : 0;

  const averageScore =
    grades.length > 0
      ? grades.reduce((sum, g) => sum + (Number(g.marks) / Number(g.maxMarks)) * 100, 0) / grades.length
      : 0;

  const assignmentCompletionRate =
    submissions.length > 0 ? (submissions.filter((s) => s.grade !== null).length / submissions.length) * 100 : 0;

  const innovationParticipationRate =
    totalStudents > 0 ? (innovation.length / (totalStudents * 0.5)) * 100 : 0;

  res.json({
    success: true,
    data: {
      totalStudents,
      averageAttendance: Math.round(averageAttendance * 10) / 10,
      averageScore: Math.round(averageScore * 10) / 10,
      assignmentCompletionRate: Math.round(assignmentCompletionRate * 10) / 10,
      innovationParticipationRate: Math.round(Math.min(innovationParticipationRate, 100) * 10) / 10,
    },
  });
});

// ============ RISK DETECTION ENDPOINT ============

// GET /api/analytics/risks
analyticsRouter.get("/risks", requireRoles("superadmin", "school_admin"), async (req, res) => {
  const schoolId = getSchoolId(req);

  if (!schoolId) return res.json({ success: true, data: [] });

  const students = await prisma.student.findMany({
    where: { schoolId, status: "active" },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true },
  });

  const risks = await Promise.all(
    students.map(async (s) => {
      const risk = await detectAcademicRisk(schoolId, s.id);
      return {
        studentId: s.id,
        admissionNumber: s.admissionNumber,
        name: `${s.firstName} ${s.lastName}`,
        riskLevel: risk.riskLevel,
        metrics: risk.metrics,
      };
    })
  );

  const filtered = risks.filter((r) => r.riskLevel !== "LOW").sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.riskLevel as keyof typeof order] - order[b.riskLevel as keyof typeof order];
  });

  res.json({ success: true, data: filtered });
});

// ============ AI STUDY RECOMMENDATIONS ENDPOINT ============

// GET /api/analytics/student/:studentId/recommendations
analyticsRouter.get("/student/:studentId/recommendations", requireRoles("student", "parent", "superadmin", "school_admin"), validateParams(studentIdParam), async (req, res) => {
  const { studentId } = req.params;
  const schoolId = getSchoolId(req);

  if (!schoolId) return res.status(400).json({ success: false, error: "schoolId required" });

  if (req.user!.role === "student" && req.user!.studentId !== studentId) {
    return res.status(403).json({ success: false, error: "Cannot access other student data" });
  }

  const metrics = await calculateStudentMetrics(schoolId, studentId);
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { class: true, careerProfile: true },
  });

  if (!student) return res.status(404).json({ success: false, error: "Student not found" });

  // Get weak subjects
  const grades = await prisma.grade.findMany({
    where: { studentId },
    include: { subject: true },
  });

  const weakSubjects = grades
    .filter((g) => (g.marks / g.maxMarks) * 100 < 60)
    .map((g) => g.subject.name)
    .slice(0, 3);

  // AI recommendations - with fallback
  let aiRecommendations = "";
  try {
    const genai = getGenAI();
    const subjectContext = weakSubjects.length > 0 ? `Weak subjects: ${weakSubjects.join(", ")}` : "Performing well across subjects";
    aiRecommendations = await genai.generateLearningInsights(
      studentId,
      [
        { subject: "Average Score", score: metrics.averageExamScore },
        { subject: "Attendance", score: metrics.attendanceRate },
        ...weakSubjects.map(s => ({ subject: s, score: 40 }))
      ]
    );
  } catch (e) {
    // Fallback recommendations
  }

  const recommendedFocusAreas = weakSubjects.length > 0 ? weakSubjects : ["Review coursework regularly", "Practice problem-solving"];

  res.json({
    success: true,
    data: {
      studentId,
      studyPlan: aiRecommendations || `Focus on: ${recommendedFocusAreas.join(", ")}. Dedicate extra time to weak subjects.`,
      recommendedSubjects: weakSubjects,
      practiceFocusAreas: recommendedFocusAreas,
      careerAlignmentHints: student.careerProfile?.favoriteSubjects || [],
    },
  });
});

// ============ LEGACY ENDPOINTS (KEPT FOR COMPATIBILITY) ============

analyticsRouter.get("/overview", requireRoles("superadmin", "school_admin", "teacher"), async (req, res) => {
  const schoolId = getSchoolId(req);
  if (!schoolId) {
    return res.json({
      success: true,
      data: {
        totalStudents: 0,
        totalTeachers: 0,
        totalClasses: 0,
        attendanceRate: 0,
        averageGrade: 0,
      },
    });
  }
  const [totalStudents, totalTeachers, totalClasses, attendanceToday, grades] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: "active" } }),
    prisma.teacher.count({ where: { schoolId } }),
    prisma.class.count({ where: { schoolId } }),
    prisma.attendance.findMany({
      where: {
        student: { schoolId },
        date: new Date(new Date().toISOString().slice(0, 10)),
      },
      select: { status: true },
    }),
    prisma.grade.findMany({
      where: { student: { schoolId } },
      select: { marks: true, maxMarks: true },
      take: 1000,
    }),
  ]);
  const presentCount = attendanceToday.filter((a) => a.status === "present").length;
  const totalWithAttendance = attendanceToday.length;
  const attendanceRate = totalWithAttendance > 0 ? (presentCount / totalWithAttendance) * 100 : 0;
  const avgGrade = grades.length
    ? grades.reduce((s, g) => s + (g.maxMarks ? (Number(g.marks) / Number(g.maxMarks)) * 100 : 0), 0) / grades.length
    : 0;
  res.json({
    success: true,
    data: {
      totalStudents,
      totalTeachers,
      totalClasses,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      averageGrade: Math.round(avgGrade * 10) / 10,
    },
  });
});

analyticsRouter.get("/learning-gaps", requireRoles("superadmin", "school_admin", "teacher"), async (req, res) => {
  const schoolId = getSchoolId(req);
  if (!schoolId) return res.json({ success: true, data: [] });
  const grades = await prisma.grade.findMany({
    where: { student: { schoolId } },
    include: { student: { select: { id: true, firstName: true, lastName: true } }, subject: { select: { name: true } } },
    take: 200,
  });
  const low = grades.filter((g) => g.maxMarks && Number(g.marks) / Number(g.maxMarks) < 0.5);
  res.json({
    success: true,
    data: low.slice(0, 20).map((g) => ({
      studentId: g.studentId,
      studentName: `${g.student.firstName} ${g.student.lastName}`,
      subject: g.subject.name,
      score: g.maxMarks ? Math.round((Number(g.marks) / Number(g.maxMarks)) * 100) : 0,
    })),
  });
});

analyticsRouter.get("/parent/weak-subjects/:studentId", requireRoles("parent", "superadmin", "school_admin", "teacher"), validateParams(studentIdParam), async (req, res) => {
  const { studentId } = req.params;
  if (req.user!.role === "parent" && req.user!.parentId) {
    const link = await prisma.student.findFirst({
      where: { id: studentId, parentId: req.user!.parentId },
    });
    if (!link) return res.status(403).json({ success: false, error: "Not your child" });
  }
  const grades = await prisma.grade.findMany({
    where: { studentId },
    include: { subject: { select: { name: true } } },
  });
  const weak = grades
    .filter((g) => g.maxMarks && Number(g.marks) / Number(g.maxMarks) < 0.6)
    .map((g) => ({
      subject: g.subject.name,
      score: g.maxMarks ? Math.round((Number(g.marks) / Number(g.maxMarks)) * 100) : 0,
    }));
  res.json({ success: true, data: weak });
});

analyticsRouter.get("/parent/monthly-summary/:studentId", requireRoles("parent", "superadmin", "school_admin", "teacher"), validateParams(studentIdParam), async (req, res) => {
  const { studentId } = req.params;
  if (req.user!.role === "parent" && req.user!.parentId) {
    const link = await prisma.student.findFirst({
      where: { id: studentId, parentId: req.user!.parentId },
    });
    if (!link) return res.status(403).json({ success: false, error: "Not your child" });
  }
  const [attendance, grades] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId },
      select: { status: true },
    }),
    prisma.grade.findMany({
      where: { studentId },
      include: { subject: { select: { name: true } } },
    }),
  ]);
  const present = attendance.filter((a) => a.status === "present").length;
  const attendancePct = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
  const lowSubjects = grades
    .filter((g) => g.maxMarks && Number(g.marks) / Number(g.maxMarks) < 0.6)
    .map((g) => g.subject.name);
  res.json({
    success: true,
    data: {
      attendancePercent: attendancePct,
      lowSubjects,
      suggestion: lowSubjects.length > 0
        ? `Focus on ${lowSubjects.slice(0, 2).join(" and ")} this month. Consider extra practice or teacher consultation.`
        : "Performance is on track. Keep consistent attendance.",
    },
  });
});
