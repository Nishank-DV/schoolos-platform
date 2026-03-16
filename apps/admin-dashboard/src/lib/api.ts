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

export type ApiError = { success: false; error: string; requestId?: string };

function getHeaders(includeAuth = true): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-ID": crypto.randomUUID?.() ?? `req-${Date.now()}`,
  };
  if (includeAuth) {
    const token = localStorage.getItem("token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; requestId?: string; data?: T };
  const normalizedError =
    typeof data.error === "string"
      ? data.error
      : data.error
        ? JSON.stringify(data.error)
        : `Request failed (${res.status})`;
  if (!res.ok) {
    const err = new Error(normalizedError) as Error & { status: number; requestId?: string };
    err.status = res.status;
    err.requestId = data.requestId;
    throw err;
  }
  if (data.success === false && data.error !== undefined) {
    const err = new Error(normalizedError) as Error & { requestId?: string };
    err.requestId = data.requestId;
    throw err;
  }
  return data.data as T;
}

export async function api<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const { skipAuth, ...rest } = options;
  const res = await fetch(apiUrl(path), {
    ...rest,
    headers: { ...getHeaders(!skipAuth), ...(rest.headers as Record<string, string>) },
  });
  return handleResponse<T>(res);
}

export const apiGet = <T>(path: string) => api<T>(path, { method: "GET" });
export const apiPost = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const apiPatch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const apiDelete = (path: string) => api<unknown>(path, { method: "DELETE" });
