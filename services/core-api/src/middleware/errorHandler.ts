import type { Request, Response, NextFunction } from "express";

const isProduction = process.env.NODE_ENV === "production";

export function errorHandler(
  err: Error & { statusCode?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err.statusCode ?? 500;
  const message = err.message ?? "Internal server error";
  const requestId = ( _req as Request & { requestId?: string }).requestId;
  if (status >= 500) console.error("[ERROR]", requestId, err);
  res.status(status).json({
    success: false,
    error: message,
    ...(requestId && { requestId }),
    ...(!isProduction && status >= 500 && { stack: err.stack }),
  });
}
