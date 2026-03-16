export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const ALLOWED_PAGE_SIZES = [10, 20, 50, 100] as const;

function normalizePage(value: string | null): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "1";
  return String(Math.max(1, Math.trunc(parsed)));
}

function normalizePageSize(value: string | null): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "20";

  const clamped = Math.min(100, Math.max(1, Math.trunc(parsed)));
  const normalized = [...ALLOWED_PAGE_SIZES].reverse().find((size) => clamped >= size) ?? ALLOWED_PAGE_SIZES[0];
  return String(normalized);
}

function sanitizePaginationParams(path: string): string {
  const [pathname, query] = path.split("?", 2);
  if (!query) return path;

  const params = new URLSearchParams(query);
  if (params.has("limit") && !params.has("pageSize")) {
    params.set("pageSize", params.get("limit") ?? "");
  }
  if (params.has("page")) {
    params.set("page", normalizePage(params.get("page")));
  }
  if (params.has("pageSize")) {
    params.set("pageSize", normalizePageSize(params.get("pageSize")));
  }
  if (params.has("limit")) {
    params.delete("limit");
  }
  const normalizedQuery = params.toString();
  return normalizedQuery ? `${pathname}?${normalizedQuery}` : pathname;
}

export function apiUrl(path: string) {
  return `${API_BASE}${sanitizePaginationParams(path)}`;
}
