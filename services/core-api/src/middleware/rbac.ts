import type { Request, Response, NextFunction } from "express";
import type { Role } from "shared-types";

export function requireRoles(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    if (!allowed.includes(req.user.role)) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }
    next();
  };
}

export function requireSchoolAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  if (req.user.role === "superadmin") {
    next();
    return;
  }
  const schoolId = req.user.schoolId ?? (req.params.schoolId ?? req.body?.schoolId);
  if (!schoolId || schoolId !== req.user.schoolId) {
    res.status(403).json({ success: false, error: "School access denied" });
    return;
  }
  next();
}
