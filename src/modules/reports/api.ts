import { ApiError, getApiBase } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

export type ReportPeriod = "daily" | "weekly" | "monthly" | "custom";

export interface FinanceReportRequest {
  period: ReportPeriod;
  date_from?: string;
  date_to?: string;
  include_ai?: boolean;
}

export interface FinanceReportEmailResponse {
  ok: boolean;
  message: string;
  filename: string;
  period_label: string;
  date_from: string;
  date_to: string;
}

async function reportFetch(
  path: string,
  body: FinanceReportRequest
): Promise<Response> {
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const token = useAuthStore.getState().accessToken;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });
  return res;
}

function parseError(res: Response): Promise<never> {
  return res.json().then(
    (err) => {
      const detail = err.detail || err.message || res.statusText;
      throw new ApiError(String(detail), res.status);
    },
    () => {
      throw new ApiError(res.statusText, res.status);
    }
  );
}

export async function downloadFinanceReport(
  body: FinanceReportRequest
): Promise<void> {
  const res = await reportFetch("/api/v1/reports/finance/download", body);
  if (!res.ok) await parseError(res);

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  let filename = "mtk-finance-report.pdf";
  const match = disposition?.match(/filename="?([^";\n]+)"?/);
  if (match?.[1]) filename = match[1].trim();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function emailFinanceReport(
  body: FinanceReportRequest
): Promise<FinanceReportEmailResponse> {
  const res = await reportFetch("/api/v1/reports/finance/email", body);
  if (!res.ok) await parseError(res);
  return res.json();
}
