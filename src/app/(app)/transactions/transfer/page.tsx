"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    if (
      !confirm(
        `Move ${amount} from ${fromName} to ${toName}? This will update both balances.`
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
            <select
              className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              required
            >
              <option value="">Select account</option>
              {userAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>To</Label>
            <select
              className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              required
            >
              <option value="">Select account</option>
              {userAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
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
