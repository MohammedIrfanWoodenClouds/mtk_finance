/**
 * Base URL for server-side Next.js routes calling the FastAPI backend.
 * Local dev: API_URL or http://127.0.0.1:8000
 * Vercel: same deployment (vercel.json rewrites /api/v1 → Python)
 */
export function getServerApiBaseUrl(): string {
  const explicit = process.env.API_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const site = process.env.SITE_URL?.trim();
  if (site) {
    return site.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://127.0.0.1:8000";
}
