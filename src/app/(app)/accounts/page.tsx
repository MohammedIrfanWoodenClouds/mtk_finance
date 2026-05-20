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
  creditCardDisplayFromAccount,
  creditCardLimit,
  institutionLabel,
  isLiabilityAccount,
  openingBalanceHint,
  openingBalanceLabel,
  partitionAccounts,
  signedBalanceFromCardInputs,
} from "@/lib/account-types";
import { formatCurrency } from "@/lib/utils";
import {
  createAccount,
  deleteAccount,
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
  const [usedLimit, setUsedLimit] = useState("0");
  const [creditOnCard, setCreditOnCard] = useState("0");
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

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-summary"] });
      setEditingId(null);
    },
  });

  const createMut = useMutation({
    mutationFn: () => {
      const opening =
        accountType === "credit_card"
          ? signedBalanceFromCardInputs(
              parseFloat(usedLimit) || 0,
              parseFloat(creditOnCard) || 0
            )
          : parseFloat(openingBalance) || 0;
      return createAccount({
        name,
        account_type: accountType,
        opening_balance: opening,
        institution_name: institutionName.trim() || undefined,
        credit_limit:
          accountType === "credit_card" && creditLimit
            ? parseFloat(creditLimit)
            : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-summary"] });
      setShowForm(false);
      setName("");
      setOpeningBalance("0");
      setUsedLimit("0");
      setCreditOnCard("0");
      setInstitutionName("");
      setCreditLimit("");
      setAccountType("bank");
    },
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    let detail = openingBalance;
    if (accountType === "credit_card") {
      detail = `used limit ${usedLimit}`;
      if (parseFloat(creditOnCard) > 0) {
        detail += `, credit on card ${creditOnCard}`;
      }
    } else if (isLiabilityAccount(accountType)) {
      detail = `amount owed ${openingBalance}`;
    }
    if (
      !confirm(
        `Add "${name}" (${accountTypeLabel(accountType)}) with ${detail}?`
      )
    )
      return;
    createMut.mutate();
  }

  const usedNum = parseFloat(usedLimit) || 0;
  const creditNum = parseFloat(creditOnCard) || 0;
  const ccOverLimit =
    accountType === "credit_card" &&
    creditLimit !== "" &&
    creditNum <= 0 &&
    usedNum > 0 &&
    usedNum > (parseFloat(creditLimit) || 0);

  const createPreviewAvailable =
    accountType === "credit_card" &&
    creditLimit !== "" &&
    parseFloat(creditLimit) > 0
      ? Math.max(0, parseFloat(creditLimit) - (creditNum > 0 ? 0 : usedNum))
      : null;

  function renderAccountCard(acc: Account) {
    const owed = isLiabilityAccount(acc.account_type);
    const isCc = acc.account_type === "credit_card";
    const cc = isCc
      ? creditCardDisplayFromAccount(
          creditCardLimit(acc),
          parseFloat(acc.current_balance) || 0
        )
      : null;
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
            {isCc && cc ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-zinc-500">Credit limit</dt>
                  <dd className="font-medium tabular-nums">
                    {cc.limit != null ? formatCurrency(cc.limit) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Used limit</dt>
                  <dd className="font-medium tabular-nums text-amber-700 dark:text-amber-400">
                    {formatCurrency(cc.usedLimit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Available</dt>
                  <dd
                    className={`font-medium tabular-nums ${
                      cc.available != null && cc.available < 0
                        ? "text-red-700 dark:text-red-400"
                        : "text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {cc.available != null
                      ? formatCurrency(cc.available)
                      : "Set limit"}
                  </dd>
                </div>
              </dl>
            ) : !isCc ? (
              <p className="mt-1 text-xs text-zinc-400">
                {balanceCaption(acc)}
              </p>
            ) : null}
            {isCc && cc && cc.creditOnCard > 0 && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Credit on card {formatCurrency(cc.creditOnCard)} — available
                stays at {cc.limit != null ? formatCurrency(cc.limit) : "limit"}
              </p>
            )}
            {isCc && cc && cc.overLimit > 0 && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Over limit by {formatCurrency(cc.overLimit)} (used{" "}
                {formatCurrency(cc.usedLimit)} vs limit{" "}
                {cc.limit != null ? formatCurrency(cc.limit) : "—"})
              </p>
            )}
            {isCc && cc && cc.utilizationPct != null && (
              <div className="mt-2">
                <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${
                      cc.utilizationPct >= 90
                        ? "bg-red-500"
                        : cc.utilizationPct >= 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${cc.utilizationPct}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {cc.utilizationPct}% of limit used
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
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditingId(isEditing ? null : acc.id)}
          >
            {isEditing ? "Close" : "Edit"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={deleteMut.isPending}
            onClick={() => {
              const msg = acc.name
                ? `Delete "${acc.name}"? It will be removed from your list. Past transactions stay in your history.`
                : "Delete this account?";
              if (!confirm(msg)) return;
              deleteMut.mutate(acc.id);
            }}
          >
            Delete
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
                  Sum of per-card available (limit − used limit)
                </p>
                {parseFloat(summary.total_credit_on_cards || "0") > 0 && (
                  <p className="mt-0.5 text-xs text-emerald-600">
                    {formatCurrency(summary.total_credit_on_cards)} credit on
                    cards
                  </p>
                )}
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
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Credit limit</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      placeholder="Total line on card"
                    />
                  </div>
                  <div>
                    <Label>Used limit</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={usedLimit}
                      onChange={(e) => setUsedLimit(e.target.value)}
                      disabled={creditNum > 0}
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      {openingBalanceHint(accountType)}
                    </p>
                  </div>
                </div>
                <div>
                  <Label>Credit on card (overpayment)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={creditOnCard}
                    onChange={(e) => setCreditOnCard(e.target.value)}
                  />
                </div>
                {createPreviewAvailable != null && (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    Available credit: {formatCurrency(createPreviewAvailable)}
                  </p>
                )}
              </>
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
                Used limit cannot exceed credit limit.
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

      {deleteMut.error && (
        <p className="text-sm text-red-600">
          {(deleteMut.error as Error).message}
        </p>
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
