import {
  creditCardAmountOwed,
  creditCardAvailableFrom,
  creditCardCreditBalance,
  creditCardOverLimit,
} from "@/lib/credit-card-math";
import type { Account } from "@/types";

export const LIABILITY_TYPES = new Set([
  "credit_card",
  "loan",
  "loan_personal",
]);

export const ACCOUNT_TYPE_OPTIONS = [
  {
    group: "Assets (money you own)",
    options: [
      { value: "bank", label: "Savings / Bank" },
      { value: "cash", label: "Cash wallet" },
      { value: "investment", label: "Investment" },
    ],
  },
  {
    group: "Liabilities (money you owe)",
    options: [
      { value: "credit_card", label: "Credit card" },
      { value: "loan", label: "Bank / formal loan" },
      { value: "loan_personal", label: "Personal loan (friends & family)" },
    ],
  },
];

export function isLiabilityAccount(accountType: string): boolean {
  return LIABILITY_TYPES.has(accountType);
}

export function filterUserAccounts(accounts: Account[]): Account[] {
  return accounts.filter(
    (a) => !a.is_system && !a.account_type.startsWith("category_")
  );
}

export function partitionAccounts(accounts: Account[]) {
  const user = filterUserAccounts(accounts);
  return {
    assets: user.filter((a) => !isLiabilityAccount(a.account_type)),
    liabilities: user.filter((a) => isLiabilityAccount(a.account_type)),
  };
}

export function accountTypeLabel(accountType: string): string {
  for (const g of ACCOUNT_TYPE_OPTIONS) {
    const found = g.options.find((o) => o.value === accountType);
    if (found) return found.label;
  }
  return accountType.replace(/_/g, " ");
}

export function openingBalanceLabel(accountType: string): string {
  if (accountType === "credit_card") {
    return "Current balance";
  }
  if (accountType === "loan" || accountType === "loan_personal") {
    return "Outstanding loan balance";
  }
  return "Opening balance";
}

export function openingBalanceHint(accountType: string): string {
  if (accountType === "credit_card") {
    return "Positive = owed. Negative = overpayment (credit); available stays at your limit.";
  }
  if (isLiabilityAccount(accountType)) {
    return "Positive = owed. Negative = lender owes you or overpaid balance.";
  }
  return "Positive = funds available. Negative = overdraft.";
}

export function institutionLabel(accountType: string): string {
  if (accountType === "loan_personal") {
    return "Lender name (optional)";
  }
  if (accountType === "credit_card") {
    return "Card issuer (optional)";
  }
  if (accountType === "loan") {
    return "Bank / lender (optional)";
  }
  return "Institution (optional)";
}

export interface BalanceDisplay {
  amount: string;
  caption: string;
  owed: boolean;
}

export function balanceCaption(account: Account): string {
  const bal = parseMoney(account.current_balance);
  if (!isLiabilityAccount(account.account_type)) {
    return bal < 0 ? "Overdraft" : "Balance";
  }
  return bal < 0 ? "Credit on account" : "Amount owed";
}

export function parseMoney(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function creditCardLimit(account: Account): number | null {
  if (account.account_type !== "credit_card" || !account.credit_limit) {
    return null;
  }
  const limit = parseMoney(account.credit_limit);
  return limit > 0 ? limit : null;
}

export function creditCardAvailable(account: Account): number | null {
  const limit = creditCardLimit(account);
  if (limit == null) return null;
  const balance = parseMoney(account.current_balance);
  return creditCardAvailableFrom(limit, balance);
}

export function creditCardOverLimitAmount(account: Account): number | null {
  const limit = creditCardLimit(account);
  if (limit == null) return null;
  const over = creditCardOverLimit(limit, parseMoney(account.current_balance));
  return over > 0 ? over : null;
}

export function creditCardCreditOnAccount(account: Account): number | null {
  if (account.account_type !== "credit_card") return null;
  const credit = creditCardCreditBalance(parseMoney(account.current_balance));
  return credit > 0 ? credit : null;
}

export function creditCardUtilization(account: Account): number | null {
  const limit = creditCardLimit(account);
  if (limit == null || limit <= 0) return null;
  const owed = creditCardAmountOwed(parseMoney(account.current_balance));
  if (owed <= 0) return null;
  return Math.min(100, Math.round((owed / limit) * 100));
}

/** Human-readable balance for selectors and lists */
export function formatAccountBalanceLabel(account: Account): string {
  const bal = parseMoney(account.current_balance);
  if (isLiabilityAccount(account.account_type)) {
    if (bal < 0) return `credit ${Math.abs(bal).toFixed(2)}`;
    if (bal === 0) return "nothing owed";
    return `owed ${bal.toFixed(2)}`;
  }
  if (bal < 0) return `overdraft ${Math.abs(bal).toFixed(2)}`;
  return bal.toFixed(2);
}

export function balanceFieldLabel(accountType: string): string {
  return openingBalanceLabel(accountType);
}
