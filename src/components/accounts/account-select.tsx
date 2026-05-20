"use client";

import type { Account } from "@/types";
import {
  accountTypeLabel,
  filterUserAccounts,
  formatAccountBalanceLabel,
  partitionAccounts,
} from "@/lib/account-types";

type Props = {
  value: string;
  onChange: (id: string) => void;
  accounts: Account[];
  required?: boolean;
  placeholder?: string;
  excludeId?: string;
};

export function AccountSelect({
  value,
  onChange,
  accounts,
  required,
  placeholder = "Select account",
  excludeId,
}: Props) {
  const user = filterUserAccounts(accounts).filter((a) => a.id !== excludeId);
  const { assets, liabilities } = partitionAccounts(user);

  function renderOption(a: Account) {
    const suffix = ` — ${formatAccountBalanceLabel(a)}`;
    return (
      <option key={a.id} value={a.id}>
        {a.name} ({accountTypeLabel(a.account_type)}
        {suffix})
      </option>
    );
  }

  return (
    <select
      className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      <option value="">{placeholder}</option>
      {assets.length > 0 && (
        <optgroup label="Assets">
          {assets.map(renderOption)}
        </optgroup>
      )}
      {liabilities.length > 0 && (
        <optgroup label="Liabilities (owed)">
          {liabilities.map(renderOption)}
        </optgroup>
      )}
    </select>
  );
}
