export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}