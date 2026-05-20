"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CreditCardMetricsPanel,
  syncOverFromUsed,
  syncUsedFromOver,
} from "@/components/accounts/credit-card-metrics-panel";
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
import { signedBalanceFromLimitAndOver } from "@/lib/credit-card-math";
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
  const initialLimit = account.credit_limit
    ? parseFloat(account.credit_limit)
    : 0;

  const [name, setName] = useState(account.name);
  const [institution, setInstitution] = useState(account.institution_name ?? "");
  const [creditLimit, setCreditLimit] = useState(account.credit_limit ?? "");
  const [usedLimit, setUsedLimit] = useState(String(initial.usedLimit));
  const [overLimitAmount, setOverLimitAmount] = useState(
    initialLimit > 0
      ? String(syncOverFromUsed(initialLimit, initial.usedLimit, initial.creditOnCard))
      : "0"
  );
  const [creditOnCard, setCreditOnCard] = useState(String(initial.creditOnCard));
  const [balance, setBalance] = useState(account.current_balance);

  const limitNum = creditLimit !== "" ? parseFloat(creditLimit) : null;
  const creditNum = parseFloat(creditOnCard) || 0;

  function handleUsedLimitChange(value: string) {
    setUsedLimit(value);
    if (limitNum != null && limitNum > 0 && creditNum <= 0) {
      setOverLimitAmount(
        String(syncOverFromUsed(limitNum, parseFloat(value) || 0, 0))
      );
    }
  }

  function handleOverLimitChange(value: string) {
    setOverLimitAmount(value);
    if (limitNum != null && limitNum > 0 && creditNum <= 0) {
      setUsedLimit(String(syncUsedFromOver(limitNum, parseFloat(value) || 0, 0)));
    }
  }

  function handleCreditLimitChange(value: string) {
    setCreditLimit(value);
    const lim = parseFloat(value) || 0;
    if (lim > 0 && creditNum <= 0) {
      const over = parseFloat(overLimitAmount) || 0;
      setUsedLimit(String(syncUsedFromOver(lim, over, 0)));
    }
  }

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
      if (isCc && limitNum != null && limitNum > 0) {
        nextSigned = signedBalanceFromLimitAndOver(
          limitNum,
          parseFloat(overLimitAmount) || 0,
          creditNum
        );
      } else if (isCc) {
        nextSigned = signedBalanceFromCardInputs(
          parseFloat(usedLimit) || 0,
          creditNum
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

  const usedNum = parseFloat(usedLimit) || 0;

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
                onChange={(e) => handleCreditLimitChange(e.target.value)}
                placeholder="Issuer line limit"
              />
            </div>
            <div>
              <Label>Balance owed (total)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={usedLimit}
                onChange={(e) => handleUsedLimitChange(e.target.value)}
                disabled={creditNum > 0}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Total on the card = within limit + over limit.
              </p>
            </div>
          </div>
          {limitNum != null && limitNum > 0 && creditNum <= 0 && (
            <div>
              <Label>Over-limit usage</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={overLimitAmount}
                onChange={(e) => handleOverLimitChange(e.target.value)}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Amount spent beyond your credit limit (issuer may still post
                these charges). Adjusting this updates balance owed.
              </p>
            </div>
          )}
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
              Not the same as over-limit. Overpayment reduces what you owe.
            </p>
          </div>
          {limitNum != null && limitNum > 0 && (
            <CreditCardMetricsPanel
              limit={limitNum}
              usedLimit={usedNum}
              creditOnCard={creditNum}
            />
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
      {saveMut.error && (
        <p className="text-sm text-red-600">
          {(saveMut.error as Error).message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saveMut.isPending}>
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
