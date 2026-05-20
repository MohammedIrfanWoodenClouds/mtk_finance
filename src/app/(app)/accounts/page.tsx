"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AccountEditForm } from "@/components/accounts/account-edit-form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACCOUNT_TYPE_OPTIONS,
  accountTypeLabel,
  balanceCaption,
  creditCardAvailable,
  creditCardLimit,
  creditCardUtilization,
  institutionLabel,
  parseMoney,
  isLiabilityAccount,
  openingBalanceHint,
  openingBalanceLabel,
  partitionAccounts,
} from "@/lib/account-types";
import { formatCurrency } from "@/lib/utils";
import {
  createAccount,
  fetchAccountSummary,
  listAccounts,
} from "@/modules/accounts/api";
import type { Account } from "@/types";

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("bank");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [institutionName, setInstitutionName] = useState("");
  const [creditLimit, setCreditLimit] = useState("");

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  });

  const { data: summary } = useQuery({
    queryKey: ["account-summary"],
    queryFn: fetchAccountSummary,
  });

  const { assets, liabilities } = useMemo(
    () => partitionAccounts(accounts),
    [accounts]
  );

  const createMut = useMutation({
    mutationFn: () =>
      createAccount({
        name,
        account_type: accountType,
        opening_balance: parseFloat(openingBalance) || 0,
        institution_name: institutionName.trim() || undefined,
        credit_limit:
          accountType === "credit_card" && creditLimit
            ? parseFloat(creditLimit)
            : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-summary"] });
      setShowForm(false);
      setName("");
      setOpeningBalance("0");
      setInstitutionName("");
      setCreditLimit("");
      setAccountType("bank");
    },
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const owed = isLiabilityAccount(accountType);
    const label = owed ? "amount owed" : "opening balance";
    if (
      !confirm(
        `Add "${name}" (${accountTypeLabel(accountType)}) with ${label} ${openingBalance}?`
      )
    )
      return;
    createMut.mutate();
  }

  const openingNum = parseFloat(openingBalance) || 0;
  const ccOverLimit =
    accountType === "credit_card" &&
    creditLimit !== "" &&
    openingNum > 0 &&
    openingNum > (parseFloat(creditLimit) || 0);

  function renderAccountCard(acc: Account) {
    const owed = isLiabilityAccount(acc.account_type);
    const isCc = acc.account_type === "credit_card";
    const limit = creditCardLimit(acc);
    const available = creditCardAvailable(acc);
    const utilization = creditCardUtilization(acc);
    const isEditing = editingId === acc.id;

    return (
      <Card
        key={acc.id}
        className={
          owed ? "border-amber-200 dark:border-amber-900/50" : undefined
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{acc.name}</p>
            <p className="text-xs text-zinc-500">
              {accountTypeLabel(acc.account_type)}
              {acc.institution_name ? ` · ${acc.institution_name}` : ""}
            </p>
            {isCc ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-zinc-500">Limit</dt>
                  <dd className="font-medium tabular-nums">
                    {limit != null ? formatCurrency(limit) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Balance</dt>
                  <dd
                    className={`font-medium tabular-nums ${
                      parseMoney(acc.current_balance) < 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {formatCurrency(acc.current_balance)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Available</dt>
                  <dd className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                    {available != null
                      ? formatCurrency(available)
                      : "Set limit"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-1 text-xs text-zinc-400">
                {balanceCaption(acc)}
              </p>
            )}
            {utilization != null && (
              <div className="mt-2">
                <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${
                      utilization >= 90
                        ? "bg-red-500"
                        : utilization >= 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${utilization}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {utilization}% of limit used
                </p>
              </div>
            )}
          </div>
          {!isCc && (
            <p
              className={`shrink-0 text-lg font-semibold tabular-nums ${
                owed ? "text-amber-700 dark:text-amber-400" : ""
              }`}
            >
              {formatCurrency(acc.current_balance)}
            </p>
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditingId(isEditing ? null : acc.id)}
          >
            {isEditing ? "Close" : "Edit"}
          </Button>
        </div>
        {isEditing && (
          <AccountEditForm
            account={acc}
            onDone={() => setEditingId(null)}
          />
        )}
      </Card>
    );
  }

  const totalAssets = summary ? parseFloat(summary.total_assets) : 0;
  const totalLiabilities = summary
    ? parseFloat(summary.total_liabilities)
    : 0;
  const netWorth = summary ? parseFloat(summary.net_worth) : 0;
  const availableCredit = summary
    ? parseFloat(summary.available_credit)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-zinc-500">
            Assets are money you own. Credit limits are not assets — only
            outstanding balances count as liabilities.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/transactions/transfer">
            <Button size="sm" variant="outline">
              Transfer
            </Button>
          </Link>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "Add account"}
          </Button>
        </div>
      </div>

      {summary && (
        <Card className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase text-zinc-500">
                Total assets
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(totalAssets)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-zinc-500">
                Total owed
              </p>
              <p className="mt-1 text-xl font-semibold text-amber-700 dark:text-amber-400">
                {formatCurrency(totalLiabilities)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-zinc-500">
                Net worth
              </p>
              <p className="mt-1 text-xl font-semibold">
                {formatCurrency(netWorth)}
              </p>
            </div>
            {summary.has_credit_limits && (
              <div>
                <p className="text-xs font-medium uppercase text-zinc-500">
                  Credit available
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {formatCurrency(availableCredit)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Limit {formatCurrency(summary.total_credit_limit)} − owed{" "}
                  {formatCurrency(summary.total_credit_outstanding)}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardTitle className="mb-4">New account</CardTitle>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  accountType === "loan_personal"
                    ? "e.g. Loan from Ahmed"
                    : "e.g. HDFC Savings"
                }
                required
              />
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
              >
                {ACCOUNT_TYPE_OPTIONS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.options.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <Label>{institutionLabel(accountType)}</Label>
              <Input
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder={
                  accountType === "loan_personal"
                    ? "Friend or family name"
                    : "Bank or card company"
                }
              />
            </div>
            {accountType === "credit_card" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Credit limit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="Maximum on the card"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Not added to assets — used to show available credit.
                  </p>
                </div>
                <div>
                  <Label>Current balance</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    {openingBalanceHint(accountType)}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Label>{openingBalanceLabel(accountType)}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                />
                <p className="mt-1 text-xs text-zinc-500">
                  {openingBalanceHint(accountType)}
                </p>
              </div>
            )}
            {ccOverLimit && (
              <p className="text-sm text-red-600">
                Outstanding cannot exceed credit limit.
              </p>
            )}
            {createMut.error && (
              <p className="text-sm text-red-600">
                {(createMut.error as Error).message}
              </p>
            )}
            <Button
              type="submit"
              disabled={createMut.isPending || ccOverLimit}
            >
              {createMut.isPending ? "Saving…" : "Save account"}
            </Button>
          </form>
        </Card>
      )}

      {isLoading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : assets.length === 0 && liabilities.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">
            No accounts yet. Add a bank account, credit card, or personal loan.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Assets
            </h2>
            {assets.length === 0 ? (
              <p className="text-sm text-zinc-500">No asset accounts</p>
            ) : (
              <ul className="space-y-3">{assets.map(renderAccountCard)}</ul>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Liabilities (owed)
            </h2>
            {liabilities.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No credit cards or loans. Add a card or track money borrowed
                from friends under Personal loan.
              </p>
            ) : (
              <ul className="space-y-3">
                {liabilities.map(renderAccountCard)}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
