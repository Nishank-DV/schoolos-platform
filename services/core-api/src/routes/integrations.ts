import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import type { StudentContext } from "shared-types";

export const integrationsRouter = Router();

// CareerBuddy webhook: receive events from AI/careerbuddy engine
integrationsRouter.post("/careerbuddy/webhook", async (req, res) => {
  const { event, payload } = req.body ?? {};
  if (!event) {
    return res.status(400).json({ success: false, error: "event required" });
  }
  // Log and optionally process (e.g. report generated, assessment completed)
  console.log("[CareerBuddy webhook]", event, payload);
  res.json({ success: true, received: true });
});

// Optional: API key auth for integration_service role
integrationsRouter.get("/careerbuddy/student-context/:studentId", async (req, res) => {
  const studentId = req.params.studentId;
  const apiKey = req.headers["x-api-key"];
  if (process.env.INTEGRATION_API_KEY && apiKey !== process.env.INTEGRATION_API_KEY) {
    return res.status(401).json({ success: false, error: "Invalid API key" });
  }
  const student = await prisma.student.findFirst({
    where: { id: studentId },
    include: { school: true, careerProfile: true },
  });
  if (!student) return res.status(404).json({ success: false, error: "Student not found" });
  const profile = student.careerProfile;
  const context: StudentContext = {
    studentId: student.id,
    name: `${student.firstName} ${student.lastName}`,
    grade: student.grade,
    school: student.school.name,
    favoriteSubjects: profile?.favoriteSubjects ?? [],
    hobbies: profile?.hobbies ?? [],
    likedActivities: profile?.likedActivities ?? [],
    dislikedActivities: profile?.dislikedActivities ?? [],
  };
  res.json({ success: true, data: context });
});
