"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  balanceFieldLabel,
  cardInputsFromSignedBalance,
  institutionLabel,
  isLiabilityAccount,
  openingBalanceHint,
  parseMoney,
  signedBalanceFromCardInputs,
} from "@/lib/account-types";
import { formatCurrency } from "@/lib/utils";
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
  const initial = cardInputsFromSignedBalance(
    parseMoney(account.current_balance)
  );

  const [name, setName] = useState(account.name);
  const [institution, setInstitution] = useState(account.institution_name ?? "");
  const [creditLimit, setCreditLimit] = useState(account.credit_limit ?? "");
  const [usedLimit, setUsedLimit] = useState(String(initial.usedLimit));
  const [creditOnCard, setCreditOnCard] = useState(String(initial.creditOnCard));
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

      let nextSigned: number;
      if (isCc) {
        nextSigned = signedBalanceFromCardInputs(
          parseFloat(usedLimit) || 0,
          parseFloat(creditOnCard) || 0
        );
      } else {
        nextSigned = parseFloat(balance);
      }

      const current = parseMoney(account.current_balance);
      if (!Number.isNaN(nextSigned) && nextSigned !== current) {
        payload.current_outstanding = nextSigned;
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
    saveMut.mutate();
  }

  const limitNum = creditLimit !== "" ? parseFloat(creditLimit) : null;
  const usedNum = parseFloat(usedLimit) || 0;
  const creditNum = parseFloat(creditOnCard) || 0;
  const overLimit =
    isCc &&
    limitNum != null &&
    limitNum > 0 &&
    creditNum <= 0 &&
    usedNum > limitNum;

  const previewAvailable =
    isCc && limitNum != null && limitNum > 0
      ? Math.max(0, limitNum - (creditNum > 0 ? 0 : usedNum))
      : null;

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
        <>
          <div className="grid gap-3 sm:grid-cols-2">
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
                {openingBalanceHint("credit_card")}
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
              placeholder="0 if none"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Optional. If set, used limit is treated as 0 and available stays
              at your full limit.
            </p>
          </div>
          {previewAvailable != null && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Available credit: {formatCurrency(previewAvailable)} (limit − used
              limit)
            </p>
          )}
        </>
      )}
      {!isCc && (
        <div>
          <Label>{balanceFieldLabel(account.account_type)}</Label>
          <Input
            type="number"
            step="0.01"
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
          Used limit cannot exceed credit limit.
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
