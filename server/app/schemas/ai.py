from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(description="user or assistant")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class ChatResponse(BaseModel):
    reply: str
    disclaimer: str = (
        "AI advice only — always confirm amounts in your ledger before acting."
    )


class AiLimitsResponse(BaseModel):
    rpm_limit: int
    rpd_limit: int
    min_interval_seconds: int
    requests_remaining_minute: int
    requests_remaining_day: int
    retry_after_seconds: int | None = None
    model: str
    api_keys_configured: int = 0
    api_keys_available: int = 0
    models_configured: int = 0
    models: list[str] = Field(default_factory=list)
