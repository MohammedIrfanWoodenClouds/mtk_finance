"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACCOUNT_TYPE_OPTIONS,
  accountTypeLabel,
  balanceCaption,
  institutionLabel,
  isLiabilityAccount,
  openingBalanceHint,
  openingBalanceLabel,
  partitionAccounts,
} from "@/lib/account-types";
import { formatCurrency } from "@/lib/utils";
import { createAccount, listAccounts } from "@/modules/accounts/api";

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("bank");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [institutionName, setInstitutionName] = useState("");
  const [creditLimit, setCreditLimit] = useState("");

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
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

  function renderAccountCard(acc: (typeof accounts)[0]) {
    const owed = isLiabilityAccount(acc.account_type);
    const limit = acc.credit_limit ? parseFloat(acc.credit_limit) : null;
    const balance = parseFloat(acc.current_balance);
    const utilization =
      owed && limit && limit > 0
        ? Math.round((balance / limit) * 100)
        : null;

    return (
      <Card
        key={acc.id}
        className={
          owed
            ? "border-amber-200 dark:border-amber-900/50"
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">{acc.name}</p>
            <p className="text-xs text-zinc-500">
              {accountTypeLabel(acc.account_type)}
              {acc.institution_name ? ` · ${acc.institution_name}` : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {balanceCaption(acc)}
              {limit != null && ` · Limit ${formatCurrency(limit)}`}
              {utilization != null && ` · ${utilization}% used`}
            </p>
          </div>
          <p
            className={`text-lg font-semibold tabular-nums ${
              owed ? "text-amber-700 dark:text-amber-400" : ""
            }`}
          >
            {formatCurrency(acc.current_balance)}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-zinc-500">
            Assets are money you own. Liabilities are debt (credit cards, loans).
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add account"}
        </Button>
      </div>

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
            {accountType === "credit_card" && (
              <div>
                <Label>Credit limit (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="Maximum card limit — not your balance"
                />
              </div>
            )}
            <div>
              <Label>{openingBalanceLabel(accountType)}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
              <p className="mt-1 text-xs text-zinc-500">
                {openingBalanceHint(accountType)}
              </p>
            </div>
            {createMut.error && (
              <p className="text-sm text-red-600">
                {(createMut.error as Error).message}
              </p>
            )}
            <Button type="submit" disabled={createMut.isPending}>
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
                No credit cards or loans. Add a card or track money borrowed from
                friends under Personal loan.
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
