import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerApiBaseUrl } from "@/lib/server-api-url";
const REFRESH_COOKIE = "mtk_refresh_token";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ authenticated: false, access_token: null });
  }

  try {
    const res = await fetch(`${getServerApiBaseUrl()}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      const response = NextResponse.json({
        authenticated: false,
        access_token: null,
      });
      response.cookies.delete(REFRESH_COOKIE);
      return response;
    }

    const data = await res.json();
    const response = NextResponse.json({
      authenticated: true,
      access_token: data.access_token,
    });

    response.cookies.set(REFRESH_COOKIE, data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });

    return response;
  } catch {
    return NextResponse.json(
      { authenticated: false, access_token: null, error: "API unavailable" },
      { status: 503 }
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    try {
      await fetch(`${getServerApiBaseUrl()}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      /* ignore */
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { access_token, refresh_token } = body;

  const response = NextResponse.json({ access_token });

  if (refresh_token) {
    response.cookies.set(REFRESH_COOKIE, refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
  }

  return response;
}
