import { useAuthStore } from "@/store/auth-store";

/**
 * Browser: use same origin (empty base) so /api/v1/* hits Next rewrites → FastAPI.
 * Avoids CORS when Next runs on 3001+ if 3000 is busy.
 * Server: not used for apiFetch in current app (all client components).
 */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8000"
  );
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
    public retryAfterSeconds?: number
  ) {
    super(message);
  }
}

async function refreshTokens(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.access_token) {
      useAuthStore.getState().setAccessToken(data.access_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getApiBase();
  const url = path.startsWith("http")
    ? path
    : `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = useAuthStore.getState().accessToken;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(url, { ...options, headers, credentials: "include" });

  if (
    res.status === 401 &&
    !path.includes("/auth/login") &&
    !path.includes("/auth/register")
  ) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      headers.set(
        "Authorization",
        `Bearer ${useAuthStore.getState().accessToken}`
      );
      res = await fetch(url, { ...options, headers, credentials: "include" });
    }
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail || err.message || err.error || detail;
    } catch {
      /* ignore */
    }
    const retryRaw = res.headers.get("Retry-After");
    const retryAfterSeconds = retryRaw
      ? parseInt(retryRaw, 10)
      : undefined;
    throw new ApiError(
      String(detail),
      res.status,
      undefined,
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
