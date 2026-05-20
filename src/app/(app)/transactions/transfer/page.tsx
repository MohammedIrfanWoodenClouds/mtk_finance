"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountSelect } from "@/components/accounts/account-select";
import { isLiabilityAccount } from "@/lib/account-types";
import { listAccounts } from "@/modules/accounts/api";
import { createTransaction } from "@/modules/transactions/api";

export default function TransferPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  });

  const userAccounts = accounts.filter(
    (a) => !a.is_system && !a.account_type.startsWith("category_")
  );

  const mut = useMutation({
    mutationFn: () =>
      createTransaction({
        transaction_type: "transfer",
        account_id: fromId,
        counter_account_id: toId,
        amount: parseFloat(amount),
        transaction_date: date,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      router.push("/transactions");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fromId === toId) return;
    const fromName = userAccounts.find((a) => a.id === fromId)?.name;
    const toName = userAccounts.find((a) => a.id === toId)?.name;
    const from = userAccounts.find((a) => a.id === fromId);
    const to = userAccounts.find((a) => a.id === toId);
    let hint = "";
    if (from && to && isLiabilityAccount(to.account_type)) {
      hint = " This pays down debt on the destination account.";
    } else if (from && isLiabilityAccount(from.account_type)) {
      hint = " This draws more on the credit/loan account (increases owed).";
    }
    if (
      !confirm(
        `Move ${amount} from ${fromName} to ${toName}?${hint}`
      )
    )
      return;
    mut.mutate();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Move money</h1>
      <Card>
        <CardTitle className="mb-4">Transfer between accounts</CardTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>From</Label>
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
            <Label>To</Label>
            <AccountSelect
              accounts={accounts}
              value={toId}
              onChange={setToId}
              excludeId={fromId}
              required
              placeholder="Pay to…"
            />
          </div>
          <p className="text-xs text-zinc-500">
            Pay a credit card or loan: transfer from bank → liability. Borrowing
            more: transfer from liability → bank (increases owed).
          </p>
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
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
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {mut.error && (
            <p className="text-sm text-red-600">{(mut.error as Error).message}</p>
          )}
          <Button type="submit" disabled={mut.isPending} className="w-full">
            {mut.isPending ? "Transferring…" : "Confirm transfer"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
