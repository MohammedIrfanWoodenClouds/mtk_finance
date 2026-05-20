"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  balanceFieldLabel,
  institutionLabel,
  isLiabilityAccount,
  openingBalanceHint,
} from "@/lib/account-types";
import { updateAccount } from "@/modules/accounts/api";
import type { Account } from "@/types";

interface AccountEditFormProps {
  account: Account;
  onDone: () => void;
}

export function AccountEditForm({ account, onDone }: AccountEditFormProps) {
  const queryClient = useQueryClient();
  const isCc = account.account_type === "credit_card";
  const owed = isLiabilityAccount(account.account_type);

  const [name, setName] = useState(account.name);
  const [institution, setInstitution] = useState(account.institution_name ?? "");
  const [creditLimit, setCreditLimit] = useState(account.credit_limit ?? "");
  const [balance, setBalance] = useState(account.current_balance);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof updateAccount>[1] = {
        name: name.trim(),
        institution_name: institution.trim() || undefined,
      };
      if (isCc && creditLimit !== "") {
        payload.credit_limit = parseFloat(creditLimit) || 0;
      }
      const nextBalance = parseFloat(balance);
      const current = parseFloat(account.current_balance);
      if (!Number.isNaN(nextBalance) && nextBalance !== current) {
        payload.current_outstanding = nextBalance;
      }
      return updateAccount(account.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-summary"] });
      onDone();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextBalance = parseFloat(balance);
    if (Number.isNaN(nextBalance) || nextBalance < 0) return;
    if (
      isCc &&
      creditLimit !== "" &&
      nextBalance > (parseFloat(creditLimit) || 0)
    ) {
      return;
    }
    saveMut.mutate();
  }

  const limitNum = creditLimit !== "" ? parseFloat(creditLimit) : null;
  const balanceNum = parseFloat(balance);
  const overLimit =
    isCc &&
    limitNum != null &&
    limitNum > 0 &&
    !Number.isNaN(balanceNum) &&
    balanceNum > limitNum;

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t pt-4">
      <div>
        <Label>Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <Label>{institutionLabel(account.account_type)}</Label>
        <Input
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
        />
      </div>
      {isCc && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Credit limit</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="Max limit on card"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Not counted as an asset — only tracks how much you can borrow.
            </p>
          </div>
          <div>
            <Label>Current outstanding</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-zinc-500">
              Statement balance you owe right now.
            </p>
          </div>
        </div>
      )}
      {!isCc && (
        <div>
          <Label>{balanceFieldLabel(account.account_type)}</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-zinc-500">
            {openingBalanceHint(account.account_type)}
          </p>
        </div>
      )}
      {overLimit && (
        <p className="text-sm text-red-600">
          Outstanding cannot exceed credit limit.
        </p>
      )}
      {saveMut.error && (
        <p className="text-sm text-red-600">
          {(saveMut.error as Error).message}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={saveMut.isPending || overLimit}
        >
          {saveMut.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {owed && !isCc && (
        <p className="text-xs text-zinc-500">
          Updating balance posts an adjustment in the ledger.
        </p>
      )}
    </form>
  );
}
