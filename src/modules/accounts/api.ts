import { apiFetch } from "@/lib/api";
import type { Account } from "@/types";

export async function listAccounts() {
  return apiFetch<Account[]>("/api/v1/accounts");
}

export async function createAccount(data: {
  name: string;
  account_type: string;
  opening_balance: number;
  institution_name?: string;
  color?: string;
}) {
  return apiFetch<Account>("/api/v1/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAccount(
  id: string,
  data: Partial<{ name: string; is_active: boolean; color: string }>
) {
  return apiFetch<Account>(`/api/v1/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
