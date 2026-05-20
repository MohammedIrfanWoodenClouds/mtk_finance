"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AccountSelect } from "@/components/accounts/account-select";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildTransferPreview,
  transferConfirmMessage,
} from "@/lib/transfer-utils";
import { formatCurrency } from "@/lib/utils";
import { listAccounts } from "@/modules/accounts/api";
import { listCategories } from "@/modules/categories/api";
import { createTransaction } from "@/modules/transactions/api";

export default function TransferPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [hasFee, setHasFee] = useState(false);
  const [feeAmount, setFeeAmount] = useState("");
  const [feeCategoryId, setFeeCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const expenseCategories = categories.filter((c) => c.type === "expense");

  const fromAccount = accounts.find((a) => a.id === fromId);
  const toAccount = accounts.find((a) => a.id === toId);

  const defaultFeeCategory = useMemo(
    () =>
      expenseCategories.find((c) => c.name === "Transfer fees")?.id ?? "",
    [expenseCategories]
  );

  const preview = useMemo(
    () =>
      buildTransferPreview(
        fromAccount,
        toAccount,
        amount,
        hasFee ? feeAmount : "0"
      ),
    [fromAccount, toAccount, amount, hasFee, feeAmount]
  );

  const fee = hasFee ? parseFloat(feeAmount) || 0 : 0;
  const principal = parseFloat(amount) || 0;
  const feeMissing = hasFee && fee > 0 && !feeCategoryId;
  const invalidAmount = principal <= 0;
  const invalidFee = hasFee && (fee <= 0 || Number.isNaN(fee));

  const mut = useMutation({
    mutationFn: () =>
      createTransaction({
        transaction_type: "transfer",
        account_id: fromId,
        counter_account_id: toId,
        amount: principal,
        transfer_fee: hasFee && fee > 0 ? fee : undefined,
        category_id:
          hasFee && fee > 0 ? feeCategoryId || defaultFeeCategory : undefined,
        transaction_date: date,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-summary"] });
      router.push("/transactions");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fromId === toId || !fromAccount || !toAccount) return;
    if (feeMissing || invalidAmount || (hasFee && invalidFee)) return;
    if (!confirm(transferConfirmMessage(fromAccount, toAccount, principal, fee)))
      return;
    mut.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transfer between accounts</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pay credit cards, move cash between banks, or pay loans. Optional
          charges (wire fees, FX) are recorded as expenses.
        </p>
      </div>

      <Card>
        <CardTitle className="mb-4">Move money</CardTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>From (source)</Label>
              <AccountSelect
                accounts={accounts}
                value={fromId}
                onChange={setFromId}
                excludeId={toId}
                required
                placeholder="Pay from…"
              />
            </div>
            <div>
              <Label>To (destination)</Label>
              <AccountSelect
                accounts={accounts}
                value={toId}
                onChange={setToId}
                excludeId={fromId}
                required
                placeholder="Receive at…"
              />
            </div>
          </div>

          {(fromAccount || toAccount) && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-zinc-700 dark:text-zinc-300">{preview.scenario}</p>
              {preview.warnings.map((w) => (
                <p key={w} className="mt-2 text-amber-700 dark:text-amber-400">
                  {w}
                </p>
              ))}
            </div>
          )}

          <div>
            <Label>Amount received by destination</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Principal applied to card / loan / account"
              required
            />
            <p className="mt-1 text-xs text-zinc-500">
              For credit cards, this is the payment that reduces your statement
              balance — not your credit limit.
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={hasFee}
                onChange={(e) => {
                  setHasFee(e.target.checked);
                  if (e.target.checked && !feeCategoryId && defaultFeeCategory) {
                    setFeeCategoryId(defaultFeeCategory);
                  }
                }}
                className="rounded border-zinc-400"
              />
              Add transfer charge / fee
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              Bank wire fees, UPI charges, or FX markup — debited from the
              source account and booked as an expense (
              <a
                href="https://www.double-entry-bookkeeping.com/bookkeeping-basics/bank-transaction-journal-entries/"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                double-entry
              </a>
              ).
            </p>

            {hasFee && (
              <div className="mt-4 space-y-3">
                <div>
                  <Label>Fee amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    placeholder="e.g. 25 wire fee"
                    required
                  />
                </div>
                <div>
                  <Label>Fee category</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    value={feeCategoryId || defaultFeeCategory}
                    onChange={(e) => setFeeCategoryId(e.target.value)}
                    required
                  >
                    <option value="">Select expense category</option>
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {principal > 0 && fromAccount && (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
              <p className="font-medium text-emerald-900 dark:text-emerald-200">
                Total leaving {fromAccount.name}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                {formatCurrency(preview.totalFrom)}
              </p>
              {fee > 0 && (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(principal)} to destination +{" "}
                  {formatCurrency(fee)} fee
                </p>
              )}
            </div>
          )}

          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. May statement payment"
            />
          </div>

          {feeMissing && (
            <p className="text-sm text-red-600">
              Select a category for the transfer fee.
            </p>
          )}
          {mut.error && (
            <p className="text-sm text-red-600">
              {(mut.error as Error).message}
            </p>
          )}

          <Button
            type="submit"
            disabled={
              mut.isPending ||
              feeMissing ||
              invalidAmount ||
              (hasFee && invalidFee)
            }
            className="w-full"
          >
            {mut.isPending ? "Transferring…" : "Confirm transfer"}
          </Button>
        </form>
      </Card>

      <Card className="text-sm text-zinc-600 dark:text-zinc-400">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">
          Common transfers
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Pay credit card: Bank → Credit card</li>
          <li>Pay personal loan: Bank → Personal loan</li>
          <li>Move savings: Bank → Bank or Cash</li>
          <li>Balance transfer: Credit card → Credit card</li>
        </ul>
        <Link
          href="/accounts"
          className="mt-3 inline-block text-emerald-600 hover:underline"
        >
          Manage accounts
        </Link>
      </Card>
    </div>
  );
}
