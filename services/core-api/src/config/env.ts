import { z } from "zod";
import dotenv from "dotenv";

// Load .env during local/dev execution. In production, rely on platform-provided env vars.
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1).default("schoolos-demo-secret-change-in-production"),
  JWT_EXPIRES: z.string().default("7d"),
  CORS_ORIGIN: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;
const DEV_JWT_FALLBACK = "schoolos-demo-secret-change-in-production";

export function getEnv(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const msg = result.error.flatten().fieldErrors;
    throw new Error("Invalid environment: " + JSON.stringify(msg));
  }

  if (result.data.NODE_ENV === "production") {
    if (result.data.JWT_SECRET === DEV_JWT_FALLBACK) {
      throw new Error("Invalid environment: JWT_SECRET must be explicitly set in production");
    }
    if (!result.data.CORS_ORIGIN) {
      throw new Error("Invalid environment: CORS_ORIGIN is required in production");
    }
  }

  cached = result.data;
  return cached;
}
