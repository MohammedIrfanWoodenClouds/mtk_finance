import { apiFetch } from "@/lib/api";
import type { Account, AccountSummary } from "@/types";

export async function listAccounts() {
  return apiFetch<Account[]>("/api/v1/accounts");
}

export async function fetchAccountSummary() {
  return apiFetch<AccountSummary>("/api/v1/accounts/summary");
}

export async function createAccount(data: {
  name: string;
  account_type: string;
  opening_balance: number;
  institution_name?: string;
  credit_limit?: number;
  color?: string;
}) {
  return apiFetch<Account>("/api/v1/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAccount(
  id: string,
  data: Partial<{
    name: string;
    is_active: boolean;
    color: string;
    credit_limit: number;
    current_outstanding: number;
    institution_name: string;
  }>
) {
  return apiFetch<Account>(`/api/v1/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
