import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { z } from "zod";

const idParam = z.object({ id: z.string().cuid() });
const createQuizBody = z.object({
  classId: z.string().cuid(),
  subjectId: z.string().cuid().optional(),
  title: z.string().min(1),
  maxMarks: z.number().int().min(1),
  dueDate: z.string().optional(),
});
const questionBody = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).min(2),
  correctIndex: z.number().int().min(0),
  orderIndex: z.number().int().min(0),
  marks: z.number().int().min(1).optional(),
});
export const quizzesRouter = Router();
quizzesRouter.use(authMiddleware);

// List quizzes (admin/teacher: by class; student: for their classes)
quizzesRouter.get("/", async (req, res) => {
  const role = req.user!.role;
  if (role === "student" && req.user!.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: req.user!.studentId },
      select: { classId: true },
    });
    if (!student?.classId) return res.json({ success: true, data: [] });
    const quizzes = await prisma.quiz.findMany({
      where: { classId: student.classId },
      include: { class: { select: { name: true } }, subject: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ success: true, data: quizzes });
  }
  const schoolId = req.user!.schoolId;
  if (!schoolId) return res.json({ success: true, data: [] });
  const quizzes = await prisma.quiz.findMany({
    where: { class: { schoolId } },
    include: { class: { select: { name: true } }, subject: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: quizzes });
});

quizzesRouter.get("/:id", validateParams(idParam), async (req, res) => {
  const quiz = await prisma.quiz.findFirst({
    where: { id: req.params.id },
    include: { questions: { orderBy: { orderIndex: "asc" } }, class: true, subject: true },
  });
  if (!quiz) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, data: quiz });
});

quizzesRouter.post("/", requireRoles("superadmin", "school_admin", "teacher"), validateBody(createQuizBody), async (req, res) => {
  const quiz = await prisma.quiz.create({
    data: {
      classId: req.body.classId,
      subjectId: req.body.subjectId,
      title: req.body.title,
      maxMarks: req.body.maxMarks,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    },
  });
  res.status(201).json({ success: true, data: quiz });
});

quizzesRouter.post("/:quizId/questions", requireRoles("superadmin", "school_admin", "teacher"), validateBody(questionBody), async (req, res) => {
  const { quizId } = req.params;
  const q = await prisma.quizQuestion.create({
    data: {
      quizId,
      question: req.body.question,
      options: req.body.options,
      correctIndex: req.body.correctIndex,
      orderIndex: req.body.orderIndex,
      marks: req.body.marks ?? 1,
    },
  });
  res.status(201).json({ success: true, data: q });
});

// Start attempt (student)
quizzesRouter.post("/:id/start", requireRoles("student"), validateParams(idParam), async (req, res) => {
  const studentId = req.user!.studentId!;
  const attempt = await prisma.quizAttempt.create({
    data: { quizId: req.params.id, studentId },
  });
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: { questions: { orderBy: { orderIndex: "asc" }, select: { id: true, question: true, options: true, orderIndex: true } } },
  });
  res.status(201).json({
    success: true,
    data: { attempt, questions: quiz?.questions ?? [] },
  });
});

// Submit attempt (student) - send full answers { questionId: selectedIndex }
quizzesRouter.post("/:id/submit", requireRoles("student"), validateParams(idParam), async (req, res) => {
  const studentId = req.user!.studentId!;
  const answers = req.body.answers as Record<string, number> | undefined;
  if (!answers || typeof answers !== "object") return res.status(400).json({ success: false, error: "answers object required" });
  const attempt = await prisma.quizAttempt.findFirst({
    where: { quizId: req.params.id, studentId, completedAt: null },
  });
  if (!attempt) return res.status(404).json({ success: false, error: "No active attempt" });
  const questions = await prisma.quizQuestion.findMany({ where: { quizId: req.params.id } });
  let score = 0;
  const maxMarks = questions.reduce((s, q) => s + q.marks, 0);
  for (const q of questions) {
    const sel = answers[q.id];
    if (typeof sel === "number" && sel === q.correctIndex) score += q.marks;
  }
  const updated = await prisma.quizAttempt.update({
    where: { id: attempt.id },
    data: { score, maxMarks, completedAt: new Date(), answers: answers as object },
  });
  res.json({ success: true, data: updated });
});
