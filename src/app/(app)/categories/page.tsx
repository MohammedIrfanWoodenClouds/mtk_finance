"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCategory, listCategories } from "@/modules/categories/api";

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("expense");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const mut = useMutation({
    mutationFn: () => createCategory({ name, type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setShowForm(false);
      setName("");
    },
  });

  const grouped = {
    income: categories.filter((c) => c.type === "income"),
    expense: categories.filter((c) => c.type === "expense"),
    investment: categories.filter((c) => c.type === "investment"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add category"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mut.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="investment">Investment</option>
              </select>
            </div>
            <Button type="submit" disabled={mut.isPending}>
              Save
            </Button>
          </form>
        </Card>
      )}

      {(["income", "expense", "investment"] as const).map((t) => (
        <Card key={t}>
          <CardTitle className="mb-3 capitalize">{t}</CardTitle>
          <ul className="flex flex-wrap gap-2">
            {grouped[t].map((c) => (
              <li
                key={c.id}
                className="rounded-full px-3 py-1 text-sm"
                style={{
                  backgroundColor: c.color ? `${c.color}22` : "#f4f4f5",
                  color: c.color || undefined,
                }}
              >
                {c.name}
                {c.is_system && (
                  <span className="ml-1 text-xs opacity-60">· default</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
