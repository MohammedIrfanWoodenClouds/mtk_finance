"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listAccounts } from "@/modules/accounts/api";
import { listCategories } from "@/modules/categories/api";
import { createTransaction } from "@/modules/transactions/api";

export default function NewTransactionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
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

  const userAccounts = accounts.filter(
    (a) => !a.is_system && !a.account_type.startsWith("category_")
  );
  const filteredCategories = categories.filter((c) => c.type === type);

  const mut = useMutation({
    mutationFn: () =>
      createTransaction({
        transaction_type: type,
        account_id: accountId,
        category_id: categoryId,
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
    const label = type === "income" ? "Money in" : "Money out";
    if (
      !confirm(
        `Confirm ${label} of ${amount} on ${date}? This will update your balances.`
      )
    )
      return;
    mut.mutate();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add entry</h1>
      <Card>
        <div className="mb-4 flex gap-2">
          <Button
            type="button"
            variant={type === "expense" ? "default" : "outline"}
            onClick={() => setType("expense")}
          >
            Money out
          </Button>
          <Button
            type="button"
            variant={type === "income" ? "default" : "outline"}
            onClick={() => setType("income")}
          >
            Money in
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Account</Label>
            <select
              className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
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
            <Label>Category</Label>
            <select
              className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Select category</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
            {mut.isPending ? "Saving…" : "Save entry"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
