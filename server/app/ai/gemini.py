import asyncio
import json
import logging
import re
import time
from threading import Lock

import httpx
from fastapi import HTTPException

from app.ai.gemini_keys import GeminiKeyPool, KeyFailureReason, get_key_pool
from app.core.config import Settings, get_settings
from app.schemas.ai import ChatMessage

logger = logging.getLogger(__name__)

GENERATE_CONTENT_BASE = (
    "https://generativelanguage.googleapis.com/v1beta/models"
)

SYSTEM_PROMPT = """You are MTK Finance Assistant — a helpful personal finance advisor inside a ledger app.

Rules you MUST follow:
- Use ONLY the financial snapshot provided below to answer questions about this user's money.
- Give practical, plain-language advice about spending, saving, budgets, and categories.
- NEVER tell the user you changed, deleted, or created any transaction, account, or balance.
- NEVER invent transactions or balances not in the snapshot.
- If data is missing, say so and suggest what they could track in the app.
- Keep answers concise (2–4 short paragraphs max unless they ask for detail).
- Currency is INR unless the user says otherwise.
"""

QUOTA_EXHAUSTED_USER_MESSAGE = (
    "Gemini free-tier quota is used up for all configured models and API keys. "
    "Enable billing at https://aistudio.google.com/apikey, wait for daily reset "
    "(midnight Pacific), or set GEMINI_MODEL=gemini-flash-latest in .env if that model still has quota."
)

# (key_label, model_name) -> cooldown_until — quota is often per-model, not whole key
_model_cooldowns: dict[tuple[str, str], float] = {}
_model_lock = Lock()


def _settings_pool(settings: Settings) -> GeminiKeyPool:
    return get_key_pool(
        settings.gemini_api_keys,
        quota_cooldown_seconds=settings.GEMINI_KEY_QUOTA_COOLDOWN_SECONDS,
        rate_limit_cooldown_seconds=settings.GEMINI_KEY_RATE_LIMIT_COOLDOWN_SECONDS,
        auth_cooldown_seconds=settings.GEMINI_KEY_AUTH_COOLDOWN_SECONDS,
    )


def _model_url(model: str) -> str:
    return f"{GENERATE_CONTENT_BASE}/{model}:generateContent"


def _is_model_available(key_label: str, model: str) -> bool:
    with _model_lock:
        until = _model_cooldowns.get((key_label, model), 0.0)
    return time.time() >= until


def _mark_model_quota_exhausted(
    key_label: str, model: str, cooldown_seconds: int
) -> None:
    with _model_lock:
        _model_cooldowns[(key_label, model)] = time.time() + cooldown_seconds


def _parse_gemini_error(body: str) -> tuple[str, KeyFailureReason]:
    try:
        data = json.loads(body)
        err = data.get("error", data)
        message = err.get("message", body) if isinstance(err, dict) else body
        status = err.get("status", "") if isinstance(err, dict) else ""
    except json.JSONDecodeError:
        message = body
        status = ""

    if re.search(r"quota|billing|exceeded your current", message, re.IGNORECASE):
        return message[:500], KeyFailureReason.QUOTA
    if status in ("UNAUTHENTICATED", "PERMISSION_DENIED") or re.search(
        r"API key not valid|permission denied", message, re.IGNORECASE
    ):
        return message[:500], KeyFailureReason.AUTH
    if re.search(r"rate limit|too many requests", message, re.IGNORECASE):
        return message[:500], KeyFailureReason.RATE_LIMIT
    return message[:500], KeyFailureReason.OTHER


def _classify_response(status_code: int, body: str) -> KeyFailureReason:
    _, reason = _parse_gemini_error(body)
    if status_code in (401, 403):
        return KeyFailureReason.AUTH
    if status_code == 429:
        return reason if reason == KeyFailureReason.QUOTA else KeyFailureReason.RATE_LIMIT
    if status_code in (500, 502, 503, 504):
        return KeyFailureReason.SERVER
    if status_code == 400 and reason == KeyFailureReason.AUTH:
        return KeyFailureReason.AUTH
    return reason


def _retry_after_seconds(res: httpx.Response, attempt: int, base: float) -> float:
    raw = res.headers.get("Retry-After")
    if raw and raw.isdigit():
        return float(raw)
    return min(30.0, base * (2**attempt))


def _build_payload(
    user_message: str,
    history: list[ChatMessage],
    finance_context: str,
    settings: Settings,
) -> dict:
    contents = []
    for msg in history[-settings.GEMINI_MAX_HISTORY_MESSAGES :]:
        role = "model" if msg.role == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": msg.content}]})
    contents.append({"role": "user", "parts": [{"text": user_message}]})

    return {
        "systemInstruction": {
            "parts": [{"text": f"{SYSTEM_PROMPT}\n\n---\n\n{finance_context}"}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": settings.GEMINI_MAX_OUTPUT_TOKENS,
        },
    }


def _extract_reply(data: dict) -> str:
    return data["candidates"][0]["content"]["parts"][0]["text"]


class _KeyAttemptFailed(Exception):
    def __init__(
        self,
        reason: KeyFailureReason,
        message: str,
        response: httpx.Response | None,
        *,
        model: str,
    ) -> None:
        self.reason = reason
        self.message = message
        self.response = response
        self.model = model
        super().__init__(message)


async def _request_once(
    client: httpx.AsyncClient,
    *,
    model: str,
    api_key: str,
    payload: dict,
    max_retries: int,
    retry_base_sec: float,
) -> str:
    url = _model_url(model)
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": api_key,
    }
    last_message = "unknown error"

    for attempt in range(max_retries + 1):
        res = await client.post(url, headers=headers, json=payload)

        if res.status_code == 200:
            try:
                return _extract_reply(res.json())
            except (KeyError, IndexError) as e:
                raise HTTPException(
                    status_code=502,
                    detail="Unexpected AI response format",
                ) from e

        last_message, _ = _parse_gemini_error(res.text)
        reason = _classify_response(res.status_code, res.text)

        if reason == KeyFailureReason.RATE_LIMIT and attempt < max_retries:
            wait = _retry_after_seconds(res, attempt, retry_base_sec)
            logger.info(
                "Gemini rate limit model=%s; retry in %.1fs",
                model,
                wait,
            )
            await asyncio.sleep(wait)
            continue

        if reason == KeyFailureReason.SERVER and attempt < max_retries:
            await asyncio.sleep(retry_base_sec * (2**attempt))
            continue

        raise _KeyAttemptFailed(reason, last_message, res, model=model)

    raise _KeyAttemptFailed(KeyFailureReason.OTHER, last_message, None, model=model)


async def chat_with_gemini(
    user_message: str,
    history: list[ChatMessage],
    finance_context: str,
) -> str:
    settings = get_settings()
    keys = settings.gemini_api_keys
    if not keys:
        raise HTTPException(
            status_code=503,
            detail="AI is not configured. Add GEMINI_API_KEY (and optionally GEMINI_API_KEY2) to .env.",
        )

    models = settings.gemini_models
    pool = _settings_pool(settings)
    slots = pool.available_slots()
    if not slots:
        raise HTTPException(
            status_code=429,
            detail=QUOTA_EXHAUSTED_USER_MESSAGE,
            headers={"Retry-After": "300"},
        )

    payload = _build_payload(user_message, history, finance_context, settings)
    max_retries = settings.GEMINI_MAX_RETRIES
    errors: list[str] = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        for slot in slots:
            models_tried = 0
            for model in models:
                if not _is_model_available(slot.label, model):
                    continue
                models_tried += 1
                try:
                    logger.info(
                        "Gemini request key=%s model=%s",
                        slot.label,
                        model,
                    )
                    return await _request_once(
                        client,
                        model=model,
                        api_key=slot.api_key,
                        payload=payload,
                        max_retries=max_retries,
                        retry_base_sec=settings.GEMINI_RETRY_BASE_SEC,
                    )
                except _KeyAttemptFailed as exc:
                    retry_after = None
                    if exc.response is not None:
                        retry_after = _retry_after_seconds(
                            exc.response, 0, settings.GEMINI_RETRY_BASE_SEC
                        )

                    if exc.reason == KeyFailureReason.QUOTA:
                        _mark_model_quota_exhausted(
                            slot.label,
                            model,
                            settings.GEMINI_MODEL_QUOTA_COOLDOWN_SECONDS,
                        )
                        errors.append(f"{slot.label}/{model}: quota exhausted")
                        logger.warning(
                            "Quota exhausted key=%s model=%s",
                            slot.label,
                            model,
                        )
                        continue

                    if exc.reason == KeyFailureReason.AUTH:
                        pool.mark_failed(
                            slot,
                            exc.reason,
                            retry_after_seconds=retry_after,
                        )
                        errors.append(f"{slot.label}: invalid API key")
                        break

                    if exc.reason == KeyFailureReason.RATE_LIMIT:
                        pool.mark_failed(
                            slot,
                            exc.reason,
                            retry_after_seconds=retry_after,
                        )
                        errors.append(f"{slot.label}/{model}: rate limited")
                        break

                    errors.append(
                        f"{slot.label}/{model}: {exc.message[:80]}"
                    )
                    continue

            if models_tried == 0:
                errors.append(f"{slot.label}: all models in cooldown")

    detail = QUOTA_EXHAUSTED_USER_MESSAGE
    if errors:
        detail = f"{QUOTA_EXHAUSTED_USER_MESSAGE} ({'; '.join(errors[:3])})"
    raise HTTPException(
        status_code=429,
        detail=detail,
        headers={"Retry-After": "300"},
    )


def reset_ai_runtime_state() -> None:
    """Clear in-memory cooldowns (e.g. after reload or exhausted-key false positives)."""
    from app.ai.gemini_keys import reset_key_pool

    with _model_lock:
        _model_cooldowns.clear()
    reset_key_pool()


def get_pool_status() -> dict[str, int]:
    settings = get_settings()
    pool = _settings_pool(settings)
    summary = pool.status_summary()
    summary["models_configured"] = len(settings.gemini_models)
    return summary
