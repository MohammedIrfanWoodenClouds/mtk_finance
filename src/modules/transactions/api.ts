import { apiFetch } from "@/lib/api";
import type { Transaction, TransactionListResponse } from "@/types";

export async function listTransactions(params?: {
  page?: number;
  page_size?: number;
  account_id?: string;
  transaction_type?: string;
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.page_size) search.set("page_size", String(params.page_size));
  if (params?.account_id) search.set("account_id", params.account_id);
  if (params?.transaction_type)
    search.set("transaction_type", params.transaction_type);
  const q = search.toString();
  return apiFetch<TransactionListResponse>(
    `/api/v1/transactions${q ? `?${q}` : ""}`
  );
}

export async function createTransaction(data: {
  transaction_type: string;
  account_id: string;
  category_id?: string;
  counter_account_id?: string;
  amount: number;
  transfer_fee?: number;
  transaction_date: string;
  notes?: string;
}) {
  return apiFetch<Transaction>("/api/v1/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
