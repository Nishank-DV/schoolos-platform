import { z } from "zod";

const ALLOWED_PAGE_SIZES = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

function normalizePage(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.trunc(parsed));
}

function normalizePageSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;

  const clamped = Math.min(100, Math.max(1, Math.trunc(parsed)));
  const candidate = [...ALLOWED_PAGE_SIZES].reverse().find((size) => clamped >= size);
  return candidate ?? ALLOWED_PAGE_SIZES[0];
}

export const paginationSchema = z.object({
  page: z.preprocess((value) => normalizePage(value), z.number().int().min(1)).default(1),
  pageSize: z.preprocess(
    (value) => normalizePageSize(value),
    z.union([
      z.literal(ALLOWED_PAGE_SIZES[0]),
      z.literal(ALLOWED_PAGE_SIZES[1]),
      z.literal(ALLOWED_PAGE_SIZES[2]),
      z.literal(ALLOWED_PAGE_SIZES[3]),
    ])
  ).default(DEFAULT_PAGE_SIZE),
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
