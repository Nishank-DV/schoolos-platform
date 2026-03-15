import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getEnv } from "./config/env.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { createRateLimiter, createAuthRateLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { schoolsRouter } from "./routes/schools.js";
import { studentsRouter } from "./routes/students.js";
import { teachersRouter } from "./routes/teachers.js";
import { classesRouter } from "./routes/classes.js";
import { attendanceRouter } from "./routes/attendance.js";
import { assignmentsRouter } from "./routes/assignments.js";
import { gradesRouter } from "./routes/grades.js";
import { announcementsRouter } from "./routes/announcements.js";
import { financeRouter } from "./routes/finance.js";
import { innovationRouter } from "./routes/innovation.js";
import { careerbuddyRouter } from "./routes/careerbuddy.js";
import { analyticsRouter } from "./routes/analytics.js";
import { integrationsRouter } from "./routes/integrations.js";
import { usersRouter } from "./routes/users.js";
import { enquiriesRouter } from "./routes/enquiries.js";
import admissionsRouter from "./routes/admissions.js";
import { academicsRouter } from "./routes/academics.js";
import { timetableRouter } from "./routes/timetable.js";
import { quizzesRouter } from "./routes/quizzes.js";
import { eventsRouter } from "./routes/events.js";
import { ptmRouter } from "./routes/ptm.js";
import { examsRouter } from "./routes/exams.js";
import { checkDatabase } from "./lib/health.js";

const env = getEnv();
const app = express();

type CorsStaticOrigin = boolean | string | RegExp | Array<boolean | string | RegExp>;
type CorsOriginCallback = (err: Error | null, origin?: CorsStaticOrigin) => void;

const defaultDevOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
];

function parseCorsOrigins(input?: string) {
  if (!input) return [] as string[];
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: string) {
  try {
    const parsed = new URL(value);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${protocol}//${hostname}${port}`;
  } catch {
    return "";
  }
}

const configuredCorsOrigins = parseCorsOrigins(env.CORS_ORIGIN)
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOriginSet = new Set([
  ...configuredCorsOrigins,
  ...(env.NODE_ENV === "production" ? [] : defaultDevOrigins.map(normalizeOrigin).filter(Boolean)),
]);

function isAllowedOrigin(origin: string) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;
  return allowedOriginSet.has(normalizedOrigin);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(requestIdMiddleware);
app.set("trust proxy", 1);
app.use(createRateLimiter());
app.use(cors({
  origin: (origin: string | undefined, callback: CorsOriginCallback) => {
    // Non-browser/server-to-server requests can omit Origin.
    if (!origin) return callback(null, true);

    if (isAllowedOrigin(origin)) return callback(null, true);

    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Accept", "Content-Type", "Authorization", "X-Request-ID"],
}));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "core-api",
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/ready", async (_req, res) => {
  const db = await checkDatabase();
  const ok = db.ok;
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    service: "core-api",
    database: db,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", createAuthRateLimiter(), authRouter);
app.use("/api/schools", schoolsRouter);
app.use("/api/students", studentsRouter);
app.use("/api/teachers", teachersRouter);
app.use("/api/classes", classesRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/assignments", assignmentsRouter);
app.use("/api/grades", gradesRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/finance", financeRouter);
app.use("/api/innovation", innovationRouter);
app.use("/api/careerbuddy", careerbuddyRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/users", usersRouter);
app.use("/api/enquiries", enquiriesRouter);
app.use("/api/admissions", admissionsRouter);
app.use("/api/academics", academicsRouter);
app.use("/api/timetable", timetableRouter);
app.use("/api/quizzes", quizzesRouter);
app.use("/api/events", eventsRouter);
app.use("/api/ptm", ptmRouter);
app.use("/api", examsRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Core API running at http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});
