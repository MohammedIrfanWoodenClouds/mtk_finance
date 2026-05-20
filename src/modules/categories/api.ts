import { apiFetch } from "@/lib/api";
import type { Category } from "@/types";

export async function listCategories() {
  return apiFetch<Category[]>("/api/v1/categories");
}

export async function createCategory(data: {
  name: string;
  type: string;
  color?: string;
}) {
  return apiFetch<Category>("/api/v1/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
