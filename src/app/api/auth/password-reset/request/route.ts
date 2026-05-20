import { NextResponse } from "next/server";
import {
  isEmailConfigured,
  sendPasswordResetEmail,
} from "@/lib/email";
import { getServerApiBaseUrl } from "@/lib/server-api-url";
const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);
const EMAIL_INTERNAL_SECRET = process.env.EMAIL_INTERNAL_SECRET || "";

export async function POST(request: Request) {
  const body = await request.json();
  const email = body?.email;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ detail: "Email is required" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (EMAIL_INTERNAL_SECRET) {
    headers["X-Email-Internal-Secret"] = EMAIL_INTERNAL_SECRET;
  }

  const res = await fetch(
    `${getServerApiBaseUrl()}/api/v1/auth/password-reset/request`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ email }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(
      { detail: err.detail || "Request failed" },
      { status: res.status }
    );
  }

  const data = await res.json();

  if (data.reset_token && isEmailConfigured()) {
    try {
      const resetUrl = `${SITE_URL}/reset-password?token=${encodeURIComponent(data.reset_token)}`;
      await sendPasswordResetEmail(email, resetUrl);
    } catch {
      return NextResponse.json(
        { detail: "Could not send reset email. Check SMTP settings." },
        { status: 503 }
      );
    }
  }

  return NextResponse.json({
    message: "If the email exists, a reset link was sent",
  });
}
