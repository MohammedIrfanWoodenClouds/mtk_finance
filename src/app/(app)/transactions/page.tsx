"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { listTransactions } from "@/modules/transactions/api";

const TYPE_LABELS: Record<string, string> = {
  income: "Money in",
  expense: "Money out",
  transfer: "Move money",
  adjustment: "Adjustment",
};

export default function TransactionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => listTransactions({ page: 1, page_size: 50 }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activity</h1>
        <div className="flex gap-2">
          <Link href="/transactions/transfer">
            <Button variant="outline" size="sm">
              Move money
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
                  <p className="text-xs text-zinc-500">
                    {tx.transaction_date} · {tx.status}
                  </p>
                  {tx.notes && (
                    <p className="mt-1 text-xs text-zinc-400">{tx.notes}</p>
                  )}
                </div>
                <span
                  className={
                    tx.transaction_type === "income"
                      ? "font-semibold text-emerald-600"
                      : "font-semibold"
                  }
                >
                  {tx.transaction_type === "income" ? "+" : ""}
                  {formatCurrency(tx.amount)}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
