import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(rootDir, ".env") });

const nextConfig: NextConfig = {
  // /api/v1/* and /api/health are proxied via src/app/api/... route handlers
};

export default nextConfig;
