"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Transaction } from "@/types";
import type { Category } from "@/types";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function ExpenseChart({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const { labels, series } = useMemo(() => {
    const expenseByCategory: Record<string, number> = {};
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

    for (const tx of transactions) {
      if (tx.transaction_type !== "expense" || !tx.category_id) continue;
      const name = catMap[tx.category_id] || "Other";
      expenseByCategory[name] =
        (expenseByCategory[name] || 0) + parseFloat(tx.amount);
    }

    const entries = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
    return {
      labels: entries.map(([k]) => k),
      series: entries.map(([, v]) => v),
    };
  }, [transactions, categories]);

  if (series.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">No expenses yet</p>
    );
  }

  return (
    <Chart
      type="donut"
      height={280}
      series={series}
      options={{
        labels,
        legend: { position: "bottom" },
        colors: ["#059669", "#0ea5e9", "#f97316", "#8b5cf6", "#ef4444"],
      }}
    />
  );
}
