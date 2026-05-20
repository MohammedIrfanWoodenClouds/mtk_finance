"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ExpenseChart } from "@/components/charts/expense-chart";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  accountTypeLabel,
  partitionAccounts,
  resolveCreditCardDisplay,
} from "@/lib/account-types";
import { formatCurrency } from "@/lib/utils";
import { fetchAccountSummary, listAccounts } from "@/modules/accounts/api";
import { listCategories } from "@/modules/categories/api";
import { listTransactions } from "@/modules/transactions/api";

export default function DashboardPage() {
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  });
  const { data: summary } = useQuery({
    queryKey: ["account-summary"],
    queryFn: fetchAccountSummary,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });
  const { data: txData } = useQuery({
    queryKey: ["transactions", "recent"],
    queryFn: () => listTransactions({ page: 1 }),
  });

  const { assets, liabilities } = partitionAccounts(accounts);
  const recent = txData?.items.slice(0, 5) ?? [];

  const totalAssets = summary
    ? parseFloat(summary.total_assets)
    : assets.reduce((s, a) => s + parseFloat(a.current_balance), 0);
  const totalLiabilities = summary
    ? parseFloat(summary.total_liabilities)
    : liabilities.reduce((s, a) => s + parseFloat(a.current_balance), 0);
  const netWorth = summary
    ? parseFloat(summary.net_worth)
    : totalAssets - totalLiabilities;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/transactions/new">
          <Button size="sm">Add entry</Button>
        </Link>
      </div>

      <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
        <p className="text-sm text-emerald-100">Net worth</p>
        <p className="mt-1 text-3xl font-bold">{formatCurrency(netWorth)}</p>
        <p className="mt-2 text-xs text-emerald-100">
          Assets {formatCurrency(totalAssets)} − owed{" "}
          {formatCurrency(totalLiabilities)}
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-medium uppercase text-zinc-500">Assets</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-400">
            {formatCurrency(totalAssets)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Bank, cash, investments you own
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-zinc-500">
            Liabilities
          </p>
          <p className="mt-1 text-xl font-semibold text-amber-700 dark:text-amber-400">
            {formatCurrency(totalLiabilities)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Credit cards & loans you owe
            {summary?.has_credit_limits && (
              <>
                {" "}
                · {formatCurrency(summary.available_credit)} credit available
              </>
            )}
          </p>
        </Card>
      </div>

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

      {(assets.length > 0 || liabilities.length > 0) && (
        <Card>
          <CardTitle className="mb-3">Accounts</CardTitle>
          <ul className="space-y-2 text-sm">
            {assets.map((a) => (
              <li key={a.id} className="flex justify-between">
                <span>{a.name}</span>
                <span>{formatCurrency(a.current_balance)}</span>
              </li>
            ))}
            {liabilities.map((a) => {
              const isCc = a.account_type === "credit_card";
              const cc = isCc ? resolveCreditCardDisplay(a) : null;
              return (
                <li
                  key={a.id}
                  className="flex justify-between text-amber-800 dark:text-amber-300"
                >
                  <span>
                    {a.name}{" "}
                    <span className="text-xs text-zinc-500">
                      ({accountTypeLabel(a.account_type)})
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    {isCc && cc ? (
                      <>
                        used {formatCurrency(cc.usedLimit)}
                        {cc.limit != null && (
                          <span className="block text-xs text-zinc-500">
                            avail {formatCurrency(cc.available ?? 0)}
                          </span>
                        )}
                      </>
                    ) : (
                      <>owed {formatCurrency(a.current_balance)}</>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link
            href="/accounts"
            className="mt-3 block text-sm text-emerald-600 hover:underline"
          >
            Manage accounts
          </Link>
        </Card>
      )}
    </div>
  );
}
