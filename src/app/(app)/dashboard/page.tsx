"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ExpenseChart } from "@/components/charts/expense-chart";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { listAccounts } from "@/modules/accounts/api";
import { listCategories } from "@/modules/categories/api";
import { listTransactions } from "@/modules/transactions/api";

export default function DashboardPage() {
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });
  const { data: txData } = useQuery({
    queryKey: ["transactions", "recent"],
    queryFn: () => listTransactions({ page: 1 }),
  });

  const userAccounts = accounts.filter(
    (a) => !a.is_system && !a.account_type.startsWith("category_")
  );
  const totalBalance = userAccounts.reduce(
    (sum, a) => sum + parseFloat(a.current_balance),
    0
  );
  const recent = txData?.items.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/transactions/new">
          <Button size="sm">Add entry</Button>
        </Link>
      </div>

      <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
        <p className="text-sm text-emerald-100">Total balance</p>
        <p className="mt-1 text-3xl font-bold">{formatCurrency(totalBalance)}</p>
        <p className="mt-2 text-xs text-emerald-100">
          {userAccounts.length} active accounts
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle className="mb-4">Spending by category</CardTitle>
          <ExpenseChart
            transactions={txData?.items ?? []}
            categories={categories}
          />
        </Card>
        <Card>
          <CardTitle className="mb-4">Recent activity</CardTitle>
          {recent.length === 0 ? (
            <p className="text-sm text-zinc-500">No transactions yet</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="capitalize text-zinc-600 dark:text-zinc-400">
                    {tx.transaction_type === "income"
                      ? "Money in"
                      : tx.transaction_type === "expense"
                        ? "Money out"
                        : tx.transaction_type === "transfer"
                          ? "Move money"
                          : tx.transaction_type}
                  </span>
                  <span
                    className={
                      tx.transaction_type === "income"
                        ? "text-emerald-600"
                        : "text-zinc-900 dark:text-zinc-100"
                    }
                  >
                    {tx.transaction_type === "income" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/transactions"
            className="mt-4 block text-sm text-emerald-600 hover:underline"
          >
            View all
          </Link>
        </Card>
      </div>
    </div>
  );
}
