"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { createAccount, listAccounts } from "@/modules/accounts/api";

const ACCOUNT_TYPES = [
  { value: "bank", label: "Savings / Bank" },
  { value: "cash", label: "Cash wallet" },
  { value: "investment", label: "Investment" },
  { value: "credit_card", label: "Credit card" },
  { value: "loan", label: "Loan" },
];

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("bank");
  const [openingBalance, setOpeningBalance] = useState("0");

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createAccount({
        name,
        account_type: accountType,
        opening_balance: parseFloat(openingBalance) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setShowForm(false);
      setName("");
      setOpeningBalance("0");
    },
  });

  const userAccounts = accounts.filter(
    (a) => !a.is_system && !a.account_type.startsWith("category_")
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Add account "${name}" with opening balance ${openingBalance}?`))
      return;
    createMut.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
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
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Opening balance</Label>
              <Input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
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
      ) : userAccounts.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">No accounts yet. Add your first bank or cash account.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {userAccounts.map((acc) => (
            <li key={acc.id}>
              <Card className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{acc.name}</p>
                  <p className="text-xs capitalize text-zinc-500">
                    {acc.account_type.replace("_", " ")}
                  </p>
                </div>
                <p className="text-lg font-semibold">
                  {formatCurrency(acc.current_balance)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
