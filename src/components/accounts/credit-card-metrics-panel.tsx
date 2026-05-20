"use client";

import {
  creditCardDisplayFromAccount,
  creditCardOverLimit,
  creditCardUsedLimit,
  type CreditCardDisplay,
  utilizationBarWidthPct,
} from "@/lib/credit-card-math";
import { formatCurrency } from "@/lib/utils";

type CreditCardMetricsPanelProps = {
  limit: number | null;
  usedLimit: number;
  creditOnCard: number;
  /** Precomputed display; if omitted, derived from inputs */
  display?: CreditCardDisplay | null;
  compact?: boolean;
};

export function CreditCardMetricsPanel({
  limit,
  usedLimit,
  creditOnCard,
  display: displayProp,
  compact = false,
}: CreditCardMetricsPanelProps) {
  const balance =
    creditOnCard > 0 ? -creditOnCard : Math.max(0, usedLimit);
  const limitOk = limit != null && limit > 0;

  const display =
    displayProp ??
    (limitOk ? creditCardDisplayFromAccount(limit, balance) : null);

  if (!limitOk || !display) {
    return (
      <p className="text-xs text-zinc-500">Set a credit limit to see utilization.</p>
    );
  }

  const util = display.utilizationPct;
  const barWidth = utilizationBarWidthPct(util);

  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50 ${
        compact ? "space-y-2" : "space-y-3"
      }`}
    >
      <dl
        className={`grid gap-2 text-sm ${
          compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
        }`}
      >
        <div>
          <dt className="text-xs text-zinc-500">Within limit</dt>
          <dd className="font-medium tabular-nums">
            {formatCurrency(display.withinLimitUsed)}
          </dd>
        </div>
        {display.isOverLimit && (
          <div>
            <dt className="text-xs text-amber-700 dark:text-amber-400">
              Over limit
            </dt>
            <dd className="font-medium tabular-nums text-amber-700 dark:text-amber-400">
              {formatCurrency(display.overLimit)}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-zinc-500">Balance owed</dt>
          <dd className="font-medium tabular-nums text-amber-700 dark:text-amber-400">
            {formatCurrency(display.usedLimit)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Available</dt>
          <dd
            className={`font-medium tabular-nums ${
              display.available != null && display.available < 0
                ? "text-red-700 dark:text-red-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {formatCurrency(display.available ?? 0)}
          </dd>
        </div>
      </dl>

      {display.isOverLimit && (
        <p className="text-xs text-amber-800 dark:text-amber-300">
          You are {formatCurrency(display.overLimit)} over your{" "}
          {formatCurrency(display.limit!)} limit. Available credit is negative
          until the balance owed is below the limit.
        </p>
      )}

      {util != null && display.usedLimit > 0 && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all ${
                display.isOverLimit || util >= 100
                  ? "bg-red-500"
                  : util >= 70
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {util}% of limit used
            {display.isOverLimit && (
              <span className="text-red-600 dark:text-red-400">
                {" "}
                ({util - 100}% over limit)
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export function syncOverFromUsed(
  limit: number,
  usedLimit: number,
  creditOnCard: number
): number {
  if (creditOnCard > 0) return 0;
  return Math.max(0, usedLimit - limit);
}

export function syncUsedFromOver(
  limit: number,
  overLimit: number,
  creditOnCard: number
): number {
  if (creditOnCard > 0) return 0;
  return limit + Math.max(0, overLimit);
}
