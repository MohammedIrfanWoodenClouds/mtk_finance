import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(rootDir, ".env") });

const nextConfig: NextConfig = {
  // Local dev: proxy /api/v1 and /api/health to FastAPI (see scripts/dev-api.ps1).
  // On Vercel, vercel.json rewrites those paths to api/index.py (no Next proxy routes).
  async rewrites() {
    if (process.env.VERCEL) {
      return [];
    }
    const apiUrl = (process.env.API_URL || "http://127.0.0.1:8000").replace(
      /\/$/,
      ""
    );
    return [
      { source: "/api/v1/:path*", destination: `${apiUrl}/api/v1/:path*` },
      { source: "/api/health", destination: `${apiUrl}/api/health` },
    ];
  },
};

export default nextConfig;
