import { NextResponse } from "next/server";

const API_URL = (process.env.API_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
);

export async function GET() {
  const res = await fetch(`${API_URL}/api/health`, { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
