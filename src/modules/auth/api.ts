import { apiFetch } from "@/lib/api";
import type { TokenResponse, User } from "@/types";

export async function login(email: string, password: string) {
  return apiFetch<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchMe() {
  return apiFetch<User>("/api/v1/auth/me");
}

export async function setSessionCookies(tokens: TokenResponse) {
  await fetch("/api/auth/session", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tokens),
    credentials: "include",
  });
}

export async function clearSession() {
  await fetch("/api/auth/session", { method: "DELETE", credentials: "include" });
}

export async function changePassword(
  current_password: string,
  new_password: string
) {
  return apiFetch<{ message: string }>("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password, new_password }),
  });
}
