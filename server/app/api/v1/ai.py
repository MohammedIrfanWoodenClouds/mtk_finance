from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session



from app.ai.gemini import chat_with_gemini, get_pool_status

from app.ai.rate_limit import (

    combined_user_status,

    enforce_ai_request_limits,

    record_ai_request,

)

from app.core.config import get_settings

from app.core.database import get_db

from app.core.dependencies import get_current_user

from app.models.user import User

from app.schemas.ai import AiLimitsResponse, ChatRequest, ChatResponse

from app.services.ai_context_service import build_finance_context



router = APIRouter()

settings = get_settings()





@router.get("/limits", response_model=AiLimitsResponse)

def ai_limits(user: User = Depends(get_current_user)):

    st = combined_user_status(user.id, settings)

    pool = get_pool_status()

    models = settings.gemini_models
    return AiLimitsResponse(
        rpm_limit=st.rpm_limit,
        rpd_limit=st.rpd_limit,
        min_interval_seconds=st.min_interval_seconds,
        requests_remaining_minute=st.requests_remaining_minute,
        requests_remaining_day=st.requests_remaining_day,
        retry_after_seconds=st.retry_after_seconds,
        model=models[0] if models else "gemini-flash-latest",
        api_keys_configured=pool["api_keys_configured"],
        api_keys_available=pool["api_keys_available"],
        models_configured=pool.get("models_configured", len(models)),
        models=models,
    )





@router.post("/chat", response_model=ChatResponse)

async def chat(

    data: ChatRequest,

    db: Session = Depends(get_db),

    user: User = Depends(get_current_user),

):

    enforce_ai_request_limits(user.id, settings)

    record_ai_request(user.id, settings)



    context = build_finance_context(db, user.id)

    reply = await chat_with_gemini(data.message, data.history, context)

    return ChatResponse(reply=reply)

