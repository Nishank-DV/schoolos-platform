import type { Request, Response, NextFunction } from "express";
import type { z } from "zod";

function normalizePaginationAliases(query: Request["query"]): Request["query"] {
  if (!query || typeof query !== "object") return query;

  const normalized = { ...query } as Request["query"] & { limit?: unknown; pageSize?: unknown };
  if ((normalized.pageSize === undefined || normalized.pageSize === null || normalized.pageSize === "") && normalized.limit !== undefined) {
    normalized.pageSize = normalized.limit;
  }
  return normalized;
}

function formatValidationError(result: z.SafeParseError<unknown>) {
  const flat = result.error.flatten();
  const issues: string[] = [];
  for (const [field, msgs] of Object.entries(flat.fieldErrors)) {
    const list = Array.isArray(msgs) ? msgs.filter((m): m is string => typeof m === "string" && m.length > 0) : [];
    if (!list.length) continue;
    issues.push(`${field}: ${list.join(", ")}`);
  }
  if (issues.length) return issues.join("; ");
  if (flat.formErrors.length) return flat.formErrors.join(", ");
  return "Validation failed";
}

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ success: false, error: formatValidationError(result) });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(normalizePaginationAliases(req.query));
    if (!result.success) {
      res.status(400).json({ success: false, error: formatValidationError(result) });
      return;
    }
    req.query = result.data as Request["query"];
    next();
  };
}

export function validateParams<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({ success: false, error: formatValidationError(result) });
      return;
    }
    req.params = result.data;
    next();
  };
}
