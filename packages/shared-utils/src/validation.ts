import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().cuid(),
});

// Enterprise: min 8 chars, at least one letter and one number
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .refine((p) => /[A-Za-z]/.test(p), "Password must contain at least one letter")
  .refine((p) => /\d/.test(p), "Password must contain at least one number");

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createStudentSchema = z.object({
  admissionNumber: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  grade: z.number().int().min(1).max(12),
  section: z.string().optional(),
  parentId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
});

export const createSchoolSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export const createUserPasswordSchema = passwordSchema;
export const loginPasswordSchema = z.string().min(1);

export type PaginationInput = z.infer<typeof paginationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
