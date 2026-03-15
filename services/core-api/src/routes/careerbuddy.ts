import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateParams } from "../middleware/validate.js";
import { z } from "zod";
import { getGenAI } from "../lib/genai.js";

const idParam = z.object({ id: z.string().cuid() });
const sessionIdParam = z.object({ sessionId: z.string().cuid() });
const MAX_ASSESSMENT_QUESTIONS = 12;

export const careerbuddyRouter = Router();
careerbuddyRouter.use(authMiddleware);

// Student: get or create career profile
careerbuddyRouter.get("/profile", requireRoles("student"), async (req, res) => {
  const studentId = req.user!.studentId!;
  let profile = await prisma.careerProfile.findUnique({
    where: { studentId },
    include: { assessmentSessions: { orderBy: { startedAt: "desc" }, take: 5 } },
  });
  if (!profile) {
    profile = await prisma.careerProfile.create({
      data: {
        studentId,
        favoriteSubjects: [],
        hobbies: [],
        likedActivities: [],
        dislikedActivities: [],
      },
      include: { assessmentSessions: true },
    });
  }
  res.json({ success: true, data: profile });
});

careerbuddyRouter.patch("/profile", requireRoles("student"), async (req, res) => {
  const studentId = req.user!.studentId!;
  const { favoriteSubjects, hobbies, likedActivities, dislikedActivities, parentalConsent } = req.body;
  const profile = await prisma.careerProfile.upsert({
    where: { studentId },
    update: {
      favoriteSubjects: favoriteSubjects ?? undefined,
      hobbies: hobbies ?? undefined,
      likedActivities: likedActivities ?? undefined,
      dislikedActivities: dislikedActivities ?? undefined,
      parentalConsent: parentalConsent ?? undefined,
    },
    create: {
      studentId,
      favoriteSubjects: favoriteSubjects ?? [],
      hobbies: hobbies ?? [],
      likedActivities: likedActivities ?? [],
      dislikedActivities: dislikedActivities ?? [],
      parentalConsent: parentalConsent ?? false,
    },
  });
  res.json({ success: true, data: profile });
});

// Start assessment session
careerbuddyRouter.post("/sessions", requireRoles("student"), async (req, res) => {
  const studentId = req.user!.studentId!;
  let profile = await prisma.careerProfile.findUnique({ where: { studentId } });
  if (!profile) {
    profile = await prisma.careerProfile.create({
      data: { studentId, favoriteSubjects: [], hobbies: [], likedActivities: [], dislikedActivities: [] },
    });
  }
  if (!profile.parentalConsent) {
    return res.status(403).json({ success: false, error: "Parental consent required for CareerBuddy assessment" });
  }
  const session = await prisma.assessmentSession.create({
    data: { careerProfileId: profile.id, status: "in_progress" },
  });
  res.status(201).json({ success: true, data: session });
});

// Get next question (AI-generated or cached)
careerbuddyRouter.get("/sessions/:sessionId/next-question", requireRoles("student"), validateParams(sessionIdParam), async (req, res) => {
  const session = await prisma.assessmentSession.findFirst({
    where: { id: req.params.sessionId },
    include: { careerProfile: { include: { student: true } } },
  });
  if (!session || session.careerProfile.studentId !== req.user!.studentId) {
    return res.status(404).json({ success: false, error: "Session not found" });
  }
  if (session.status === "completed") {
    return res.json({ success: true, data: { completed: true } });
  }
  const existing = await prisma.assessmentQuestion.findMany({
    where: { sessionId: session.id },
    orderBy: { orderIndex: "asc" },
  });
  const answeredIds = await prisma.assessmentResponse.findMany({
    where: { sessionId: session.id },
    select: { questionId: true },
  });
  const answeredSet = new Set(answeredIds.map((r) => r.questionId));
  const nextQuestion = existing.find((q) => !answeredSet.has(q.id));
  if (nextQuestion) {
    return res.json({ success: true, data: { question: nextQuestion, completed: false } });
  }

  if (answeredSet.size >= MAX_ASSESSMENT_QUESTIONS || existing.length >= MAX_ASSESSMENT_QUESTIONS) {
    return res.json({ success: true, data: { completed: true } });
  }

  const genai = getGenAI();
  const categories = ["interest", "personality", "aptitude"];
  const category = categories[existing.length % 3];
  const responsesForContext = await prisma.assessmentResponse.findMany({
    where: { sessionId: session.id },
    include: { question: true },
  });
  const generated = await genai.generateAssessmentQuestion(category, session.careerProfile, responsesForContext);
  const options = generated.options ?? ["Strongly Agree", "Agree", "Neutral", "Disagree", "Strongly Disagree"];
  const question = await prisma.assessmentQuestion.create({
    data: {
      sessionId: session.id,
      category,
      question: generated.question,
      options,
      orderIndex: existing.length,
    },
  });
  res.json({ success: true, data: { question, completed: false } });
});

// Submit response
careerbuddyRouter.post("/sessions/:sessionId/respond", requireRoles("student"), validateParams(sessionIdParam), async (req, res) => {
  const { questionId, answer } = req.body;
  if (!questionId || answer === undefined) return res.status(400).json({ success: false, error: "questionId and answer required" });
  const session = await prisma.assessmentSession.findFirst({
    where: { id: req.params.sessionId },
    include: { careerProfile: true },
  });
  if (!session || session.careerProfile.studentId !== req.user!.studentId) {
    return res.status(404).json({ success: false, error: "Session not found" });
  }
  const response = await prisma.assessmentResponse.upsert({
    where: { sessionId_questionId: { sessionId: session.id, questionId } },
    update: { answer: String(answer) },
    create: { sessionId: session.id, questionId, answer: String(answer) },
  });
  res.json({ success: true, data: response });
});

// Complete session and generate recommendations (PRD: full report sections)
careerbuddyRouter.post("/sessions/:sessionId/complete", requireRoles("student"), validateParams(sessionIdParam), async (req, res) => {
  const session = await prisma.assessmentSession.findFirst({
    where: { id: req.params.sessionId },
    include: {
      careerProfile: { include: { student: { include: { school: true } } } },
      responses: { include: { question: true } },
    },
  });
  if (!session || session.careerProfile.studentId !== req.user!.studentId) {
    return res.status(404).json({ success: false, error: "Session not found" });
  }
  const genai = getGenAI();
  const [recommendations, streamRec, analysis] = await Promise.all([
    genai.generateCareerRecommendations(session.careerProfile, session.responses),
    genai.generateStreamRecommendation(session.careerProfile, session.responses),
    genai.analyzeAssessmentResponses(session.careerProfile, session.responses),
  ]);
  await prisma.$transaction([
    prisma.assessmentSession.update({
      where: { id: session.id },
      data: { status: "completed", completedAt: new Date() },
    }),
    ...recommendations.topCareers.slice(0, 5).map((c, i) =>
      prisma.careerRecommendation.create({
        data: {
          careerProfileId: session.careerProfileId,
          career: c.career,
          rank: i + 1,
          category: "top",
          details: c.overview || c.skillsRequired || c.educationPath || c.futureDemand
            ? { overview: c.overview, skillsRequired: c.skillsRequired, educationPath: c.educationPath, futureDemand: c.futureDemand }
            : undefined,
        },
      })
    ),
    ...recommendations.alternateCareers.slice(0, 3).map((c, i) =>
      prisma.careerRecommendation.create({
        data: {
          careerProfileId: session.careerProfileId,
          career: c.career,
          rank: i + 1,
          category: "alternate",
          details: c.overview || c.skillsRequired ? { overview: c.overview, skillsRequired: c.skillsRequired, educationPath: c.educationPath, futureDemand: c.futureDemand } : undefined,
        },
      })
    ),
    prisma.careerReport.create({
      data: {
        careerProfileId: session.careerProfileId,
        streamRecommendation: streamRec.recommended,
        alternateStreams: streamRec.alternateStreams.length ? streamRec.alternateStreams : undefined,
        summary: recommendations.summary ?? "",
        interestProfile: analysis.interestProfile,
        personalityIndicators: analysis.personalityIndicators.length ? analysis.personalityIndicators : undefined,
        aptitudeIndicators: analysis.aptitudeIndicators.length ? analysis.aptitudeIndicators : undefined,
        skillDevelopmentSuggestions: recommendations.skillDevelopmentSuggestions?.length
          ? recommendations.skillDevelopmentSuggestions.join("\n")
          : undefined,
      },
    }),
  ]);
  const updated = await prisma.assessmentSession.findUnique({
    where: { id: session.id },
    include: { careerProfile: { include: { careerRecommendations: true, careerReports: true } } },
  });
  res.json({ success: true, data: updated });
});

// Get report
careerbuddyRouter.get("/reports", requireRoles("student"), async (req, res) => {
  const studentId = req.user!.studentId!;
  const profile = await prisma.careerProfile.findUnique({
    where: { studentId },
    include: { careerReports: { orderBy: { createdAt: "desc" } }, careerRecommendations: true },
  });
  if (!profile) return res.json({ success: true, data: [] });
  res.json({ success: true, data: profile.careerReports });
});

careerbuddyRouter.get("/reports/latest", requireRoles("student"), async (req, res) => {
  const studentId = req.user!.studentId!;
  const report = await prisma.careerReport.findFirst({
    where: { careerProfile: { studentId } },
    orderBy: { createdAt: "desc" },
    include: {
      careerProfile: {
        include: {
          careerRecommendations: { orderBy: [{ category: "asc" }, { rank: "asc" }] },
          student: { include: { school: { select: { name: true } } } },
        },
      },
    },
  });
  if (!report) return res.status(404).json({ success: false, error: "No report found" });
  res.json({ success: true, data: report });
});

// Parent: view child's career report (PRD §7)
careerbuddyRouter.get("/reports/student/:studentId", requireRoles("parent"), async (req, res) => {
  const parentId = req.user!.parentId!;
  const studentId = req.params.studentId;
  const student = await prisma.student.findFirst({
    where: { id: studentId, parentId },
    select: { id: true },
  });
  if (!student) return res.status(403).json({ success: false, error: "Not your child" });
  const report = await prisma.careerReport.findFirst({
    where: { careerProfile: { studentId } },
    orderBy: { createdAt: "desc" },
    include: {
      careerProfile: {
        include: {
          careerRecommendations: { orderBy: [{ category: "asc" }, { rank: "asc" }] },
          student: { include: { school: { select: { name: true } } } },
        },
      },
    },
  });
  if (!report) return res.status(404).json({ success: false, error: "No report found" });
  res.json({ success: true, data: report });
});

// Teacher/Admin: analytics dashboard (PRD §6)
careerbuddyRouter.get("/teacher/analytics", requireRoles("superadmin", "school_admin", "teacher"), async (req, res) => {
  const schoolId = req.user!.schoolId;
  if (!schoolId) return res.json({ success: true, data: { completionRate: 0, interestDistribution: [], popularCareers: [], skillClusters: [] } });
  const students = await prisma.student.findMany({
    where: { schoolId, grade: { in: [9, 10] } },
    select: { id: true },
  });
  const studentIds = students.map((s) => s.id);
  const profiles = await prisma.careerProfile.findMany({
    where: { studentId: { in: studentIds } },
    include: {
      assessmentSessions: { select: { id: true, status: true } },
      careerRecommendations: { select: { career: true, category: true } },
    },
  });
  const totalEligible = studentIds.length;
  const completedSessions = profiles.reduce((acc, p) => {
    const completed = p.assessmentSessions.filter((s) => s.status === "completed").length;
    if (completed > 0) acc += 1;
    return acc;
  }, 0);
  const completionRate = totalEligible ? Math.round((completedSessions / totalEligible) * 100) : 0;
  const careerCounts: Record<string, number> = {};
  for (const p of profiles) {
    for (const r of p.careerRecommendations) {
      if (r.category === "top") careerCounts[r.career] = (careerCounts[r.career] ?? 0) + 1;
    }
  }
  const popularCareers = Object.entries(careerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([career, count]) => ({ career, count }));
  const interestDistribution = [
    { label: "Engineering & Tech", count: popularCareers.filter((c) => /engineer|software|data|ai|robotics/i.test(c.career)).reduce((s, c) => s + c.count, 0) },
    { label: "Business & Management", count: popularCareers.filter((c) => /manager|business|commerce/i.test(c.career)).reduce((s, c) => s + c.count, 0) },
    { label: "Creative & Design", count: popularCareers.filter((c) => /design|writer|creative/i.test(c.career)).reduce((s, c) => s + c.count, 0) },
    { label: "Research & Science", count: popularCareers.filter((c) => /research|scientist/i.test(c.career)).reduce((s, c) => s + c.count, 0) },
  ].filter((d) => d.count > 0);
  const skillClusters = [
    { label: "Programming & Tech", count: completedSessions },
    { label: "Analytical", count: Math.round(completedSessions * 0.8) },
    { label: "Leadership", count: Math.round(completedSessions * 0.5) },
  ];
  res.json({
    success: true,
    data: {
      completionRate,
      totalEligible,
      completedCount: completedSessions,
      interestDistribution,
      popularCareers,
      skillClusters,
    },
  });
});

// Admin: list CareerBuddy usage
careerbuddyRouter.get("/admin/sessions", requireRoles("superadmin", "school_admin"), async (req, res) => {
  const where = req.user!.schoolId
    ? { careerProfile: { student: { schoolId: req.user!.schoolId } } }
    : {};
  const sessions = await prisma.assessmentSession.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      careerProfile: { include: { student: { select: { id: true, firstName: true, lastName: true, grade: true } } } },
    },
  });
  res.json({ success: true, data: sessions });
});
