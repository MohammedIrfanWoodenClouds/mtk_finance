import { apiFetch } from "@/lib/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  disclaimer: string;
}

export interface AiLimits {
  rpm_limit: number;
  rpd_limit: number;
  min_interval_seconds: number;
  requests_remaining_minute: number;
  requests_remaining_day: number;
  retry_after_seconds: number | null;
  model: string;
  api_keys_configured: number;
  api_keys_available: number;
  models_configured: number;
  models: string[];
}

const MAX_HISTORY = 6;

export async function fetchAiLimits(): Promise<AiLimits> {
  return apiFetch<AiLimits>("/api/v1/ai/limits");
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const prior = history.filter((m) => m.role === "user" || m.role === "assistant");
  const trimmed = prior.slice(-MAX_HISTORY);

  return apiFetch<ChatResponse>("/api/v1/ai/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      history: trimmed.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });
}
