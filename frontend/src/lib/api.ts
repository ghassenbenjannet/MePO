// ─── Base API client ──────────────────────────────────────────────────────────
// In dev, Vite proxies /api → http://localhost:8000 (no CORS).
// In prod, set VITE_API_URL to the backend origin if on a different host.
const API_BASE = (import.meta as Record<string, unknown> & { env: Record<string, string> }).env
  .VITE_API_URL ?? "";

function getToken(): string | null {
  try {
    const raw = localStorage.getItem("shadow-po-auth");
    return raw ? (JSON.parse(raw) as { state?: { token?: string } }).state?.token ?? null : null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const json = (await res.json()) as { detail?: string };
      detail = json.detail ?? detail;
    } catch { /* ignore */ }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Convenience helpers
export const api = {
  get:    <T>(path: string)                   => apiFetch<T>(path),
  post:   <T>(path: string, body: unknown)    => apiFetch<T>(path, { method: "POST",   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)    => apiFetch<T>(path, { method: "PATCH",  body: JSON.stringify(body) }),
  delete: <T>(path: string)                   => apiFetch<T>(path, { method: "DELETE" }),
};
