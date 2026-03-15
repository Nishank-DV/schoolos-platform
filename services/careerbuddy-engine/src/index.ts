/**
 * CareerBuddy Engine - Standalone service for career assessment.
 * Can be called by core-api or used as webhook target.
 */
import "express-async-errors";
import express from "express";

const app = express();
const PORT = process.env.PORT ?? 5001;

app.use(express.json());

app.get("/health", (_, res) => res.json({ status: "ok", service: "careerbuddy-engine" }));

// Stub endpoints; full logic lives in core-api + genai adapter
app.post("/v1/assessment/next-question", (req, res) => {
  res.json({
    question: "Do you enjoy solving logical problems?",
    options: ["Strongly Agree", "Agree", "Neutral", "Disagree", "Strongly Disagree"],
    category: "interest",
  });
});

app.post("/v1/recommendations", (req, res) => {
  res.json({
    topCareers: ["Software Engineer", "AI Engineer", "Data Analyst", "Robotics Engineer"],
    alternateCareers: ["Technical Writer", "EdTech Specialist"],
    streamRecommendation: "MPC",
  });
});

app.listen(PORT, () => {
  console.log(`CareerBuddy Engine running at http://localhost:${PORT}`);
});
