import { PrismaClient } from "@prisma/client";
import { getEnv } from "../config/env.js";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const env = getEnv();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
