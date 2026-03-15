import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";

export function auditLog(action: string, resource: string, getResourceId?: (req: Request) => string | null) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.sub ?? null;
    const schoolId = req.user?.schoolId ?? null;
    const resourceId = getResourceId?.(req) ?? (req.params?.id ?? null);
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId ?? undefined,
          schoolId: schoolId ?? undefined,
          action,
          resource,
          resourceId: resourceId ?? undefined,
          metadata: { requestId: req.requestId } as object,
        },
      });
    } catch (e) {
      console.warn("Audit log write failed:", e);
    }
    next();
  };
}
