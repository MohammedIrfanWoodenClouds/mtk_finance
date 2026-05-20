"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { listAccounts } from "@/modules/accounts/api";
import { listTransactions } from "@/modules/transactions/api";

const TYPE_LABELS: Record<string, string> = {
  income: "Money in",
  expense: "Money out",
  transfer: "Transfer",
  adjustment: "Adjustment",
};

export default function TransactionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => listTransactions({ page: 1, page_size: 50 }),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  });

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts]
  );

  function transferDetail(tx: NonNullable<typeof data>["items"][number]) {
    const from = accountMap.get(tx.account_id) ?? "Account";
    const to = tx.counter_account_id
      ? accountMap.get(tx.counter_account_id) ?? "Account"
      : "";
    const fee = parseFloat(tx.transfer_fee || "0");
    let label = `${from} → ${to}`;
    if (fee > 0) {
      label += ` · fee ${formatCurrency(fee)}`;
    }
    return label;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activity</h1>
        <div className="flex gap-2">
          <Link href="/transactions/transfer">
            <Button variant="outline" size="sm">
              Transfer
            </Button>
          </Link>
          <Link href="/transactions/new">
            <Button size="sm">Add entry</Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : !data?.items.length ? (
        <Card>
          <p className="text-sm text-zinc-500">No transactions yet.</p>
          <Link
            href="/transactions/transfer"
            className="mt-2 inline-block text-sm text-emerald-600 hover:underline"
          >
            Make your first transfer
          </Link>
        </Card>
      ) : (
        <ul className="space-y-2">
          {data.items.map((tx) => (
            <li key={tx.id}>
              <Card className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    {TYPE_LABELS[tx.transaction_type] || tx.transaction_type}
                  </p>
                  {tx.transaction_type === "transfer" && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {transferDetail(tx)}
                    </p>
                  )}
                  <p className="text-xs text-zinc-500">
                    {tx.transaction_date} · {tx.status}
                  </p>
                  {tx.notes && (
                    <p className="mt-1 text-xs text-zinc-400">{tx.notes}</p>
                  )}
                </div>
                <span className="text-right font-semibold tabular-nums">
                  {tx.transaction_type === "transfer" ? (
                    <span>
                      {formatCurrency(tx.amount)}
                      {parseFloat(tx.transfer_fee || "0") > 0 && (
                        <span className="block text-xs font-normal text-zinc-500">
                          +{formatCurrency(tx.transfer_fee)} fee
                        </span>
                      )}
                    </span>
                  ) : (
                    <span
                      className={
                        tx.transaction_type === "income"
                          ? "text-emerald-600"
                          : ""
                      }
                    >
                      {tx.transaction_type === "income" ? "+" : ""}
                      {formatCurrency(tx.amount)}
                    </span>
                  )}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
