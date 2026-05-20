"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import {
  sendChatMessage,
  fetchAiLimits,
  type AiLimits,
  type ChatMessage,
} from "@/modules/assistant/api";

const STARTER_PROMPTS = [
  "Where am I spending the most?",
  "How can I save more this month?",
  "Summarize my finances",
  "What does my recent activity look like?",
];

function formatError(err: unknown): { message: string; cooldownSec: number } {
  if (err instanceof ApiError) {
    const sec = err.retryAfterSeconds ?? 0;
    if (err.status === 429) {
      if (
        err.message.includes("quota") ||
        err.message.includes("Gemini API quota")
      ) {
        return {
          message: err.message,
          cooldownSec: 0,
        };
      }
      return {
        message:
          sec > 0
            ? `${err.message} (${sec}s)`
            : err.message,
        cooldownSec: sec > 0 ? sec : 30,
      };
    }
    return { message: err.message, cooldownSec: 0 };
  }
  return {
    message: err instanceof Error ? err.message : "Failed to get reply",
    cooldownSec: 0,
  };
}

export function FinanceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your finance assistant. I can help you understand your spending, income, and accounts using your ledger data. I can't change any balances — advisory only.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldownSec, setCooldownSec] = useState(0);
  const [limits, setLimits] = useState<AiLimits | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshLimits = useCallback(async () => {
    try {
      const data = await fetchAiLimits();
      setLimits(data);
      if (data.retry_after_seconds && data.retry_after_seconds > 0) {
        setCooldownSec((prev) =>
          Math.max(prev, data.retry_after_seconds ?? 0)
        );
      }
    } catch {
      /* limits are optional UX */
    }
  }, []);

  useEffect(() => {
    refreshLimits();
  }, [refreshLimits]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => {
      setCooldownSec((s) => {
        if (s <= 1) {
          refreshLimits();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSec, refreshLimits]);

  const minInterval = limits?.min_interval_seconds ?? 6;
  const sendBlocked = loading || cooldownSec > 0;

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sendBlocked) return;

    setError("");
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    setCooldownSec(minInterval);

    try {
      const res = await sendChatMessage(trimmed, messages);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.reply },
      ]);
      await refreshLimits();
    } catch (err) {
      const { message, cooldownSec: cd } = formatError(err);
      setError(message);
      if (cd > 0) setCooldownSec((prev) => Math.max(prev, cd));
      setMessages(history);
      setInput(trimmed);
      await refreshLimits();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col md:h-[calc(100vh-4rem)]">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-bold">Finance assistant</h1>
          <p className="text-sm text-zinc-500">
            Ask about expenses, savings, and your accounts
          </p>
          {limits && (
            <p className="mt-1 text-xs text-zinc-400">
              {limits.requests_remaining_minute}/{limits.rpm_limit} req/min ·{" "}
              {limits.requests_remaining_day}/{limits.rpd_limit} today
              {limits.api_keys_configured > 0 &&
                ` · ${limits.api_keys_available}/${limits.api_keys_configured} keys`}
              {limits.models?.length > 0 &&
                ` · model ${limits.models[0]}`}
            </p>
          )}
        </div>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-500 dark:bg-zinc-800">
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="border-t border-zinc-200 px-4 py-2 text-sm text-red-600 dark:border-zinc-800">
            {error}
          </p>
        )}

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="mb-2 flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => submit(prompt)}
                disabled={sendBlocked}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                {prompt}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                cooldownSec > 0
                  ? `Wait ${cooldownSec}s before next message…`
                  : "Ask about your finances…"
              }
              disabled={sendBlocked}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sendBlocked || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 text-xs text-zinc-400">
            AI advice only — does not modify your ledger.
            {cooldownSec > 0 && ` · Cooldown ${cooldownSec}s`}
          </p>
        </div>
      </Card>
    </div>
  );
}
