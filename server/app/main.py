import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.ai.gemini import reset_ai_runtime_state
from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.database import SessionLocal, get_db
from app.db_check import check_database
from app.seed import ensure_admin_user

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_settings.cache_clear()
    reset_ai_runtime_state()
    settings = get_settings()
    logger.info(
        "AI assistant: %s key(s), models=%s",
        len(settings.gemini_api_keys),
        settings.gemini_models,
    )

    db = SessionLocal()
    try:
        ensure_admin_user(db)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    yield


settings = get_settings()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db_status = check_database(db)
    return {
        "status": "ok" if db_status["connected"] else "degraded",
        "service": settings.PROJECT_NAME,
        "database": db_status,
    }
