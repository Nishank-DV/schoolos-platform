import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema } from "shared-utils";

const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export const authRouter = Router();

authRouter.post("/login", validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      school: { select: { id: true, name: true, code: true } },
      student: { select: { id: true, firstName: true, lastName: true, grade: true } },
      parent: { select: { id: true, firstName: true, lastName: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!user) {
    return res.status(401).json({ success: false, error: "Invalid email or password" });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ success: false, error: "Invalid email or password" });
  }
  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role as import("shared-types").Role,
    schoolId: user.schoolId ?? undefined,
    studentId: user.studentId ?? undefined,
    parentId: user.parentId ?? undefined,
    teacherId: user.teacherId ?? undefined,
  });
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  const refreshToken = randomBytes(40).toString("hex");
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt },
  });
  res.json({
    success: true,
    data: {
      token,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        school: user.school,
        student: user.student,
        parent: user.parent,
        teacher: user.teacher,
      },
    },
  });
});
