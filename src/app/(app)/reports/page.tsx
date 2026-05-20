"use client";

import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  downloadFinanceReport,
  emailFinanceReport,
  type FinanceReportRequest,
  type ReportPeriod,
} from "@/modules/reports/api";

const PERIODS: { id: ReportPeriod; label: string; hint: string }[] = [
  {
    id: "daily",
    label: "Daily",
    hint: "Today (your report timezone)",
  },
  {
    id: "weekly",
    label: "Weekly",
    hint: "Last 7 days including today",
  },
  {
    id: "monthly",
    label: "Monthly",
    hint: "From the 1st of this month through today",
  },
  {
    id: "custom",
    label: "Custom",
    hint: "Pick any start and end date",
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [dateFrom, setDateFrom] = useState(daysAgoIso(6));
  const [dateTo, setDateTo] = useState(todayIso());
  const [includeAi, setIncludeAi] = useState(true);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  const payload = useMemo((): FinanceReportRequest => {
    const base: FinanceReportRequest = { period, include_ai: includeAi };
    if (period === "custom") {
      base.date_from = dateFrom;
      base.date_to = dateTo;
    }
    return base;
  }, [period, dateFrom, dateTo, includeAi]);

  const downloadMut = useMutation({
    mutationFn: () => downloadFinanceReport(payload),
  });

  const emailMut = useMutation({
    mutationFn: () => emailFinanceReport(payload),
    onSuccess: (data) => setEmailMessage(data.message),
  });

  const busy = downloadMut.isPending || emailMut.isPending;
  const error =
    (downloadMut.error as Error | null)?.message ||
    (emailMut.error as Error | null)?.message ||
    null;

  const customInvalid =
    period === "custom" && (!dateFrom || !dateTo || dateFrom > dateTo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Generate a PDF with current balances, transactions for the period, and
          AI recommendations. Download or send to your email.
        </p>
      </div>

      <Card>
        <CardTitle className="mb-4">Report period</CardTitle>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                period === p.id
                  ? "border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/40"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
            >
              <span className="font-medium">{p.label}</span>
              <span className="mt-1 block text-xs text-zinc-500">{p.hint}</span>
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeAi}
            onChange={(e) => setIncludeAi(e.target.checked)}
            className="rounded border-zinc-400"
          />
          Include AI recommendations (uses Gemini; may take a few seconds)
        </label>
      </Card>

      <Card>
        <CardTitle className="mb-2">What&apos;s included</CardTitle>
        <ul className="list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <li>Current account balances and net worth</li>
          <li>All transactions in the selected period</li>
          <li>Period income and expense totals</li>
          {includeAi && (
            <li>Personalized AI tips based on your data</li>
          )}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setEmailMessage(null);
              downloadMut.mutate();
            }}
            disabled={busy || customInvalid}
          >
            {downloadMut.isPending ? "Generating…" : "Download PDF"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setEmailMessage(null);
              emailMut.mutate();
            }}
            disabled={busy || customInvalid}
          >
            {emailMut.isPending ? "Sending…" : "Send to email"}
          </Button>
        </div>

        {customInvalid && (
          <p className="mt-3 text-sm text-red-600">
            Choose a valid date range (from must be on or before to).
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {emailMessage && (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
            {emailMessage}
          </p>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          Email uses your SMTP settings and is delivered to MAIL_TO when set
          (same as password reset).
        </p>
      </Card>
    </div>
  );
}
