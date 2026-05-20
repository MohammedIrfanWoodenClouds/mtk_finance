import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.ai.gemini import reset_ai_runtime_state
from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.database import SessionLocal, get_db
from app.db_check import check_database
from app.schema_guard import SCHEMA_OUTDATED_DETAIL, check_schema_columns
from app.seed import ensure_admin_user

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_settings.cache_clear()
    reset_ai_runtime_state()
    settings = get_settings()

    if settings.ENVIRONMENT == "local":
        logger.info(
            "AI assistant: %s key(s), models=%s",
            len(settings.gemini_api_keys),
            settings.gemini_models,
        )

    db = SessionLocal()
    try:
        schema = check_schema_columns(db)
        if not schema["ok"]:
            logger.error(
                "Database schema outdated — missing: %s. Run: npm run db:migrate",
                ", ".join(schema["missing"]),
            )
        ensure_admin_user(db)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "Startup seed failed — check DATABASE_URL / DIRECT_URL on Vercel"
        )
    finally:
        db.close()
    yield


settings = get_settings()
_show_docs = settings.ENVIRONMENT == "local"

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    docs_url="/api/docs" if _show_docs else None,
    openapi_url="/api/openapi.json" if _show_docs else None,
    redoc_url=None,
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


@app.exception_handler(ProgrammingError)
async def database_schema_error(_request: Request, exc: ProgrammingError) -> JSONResponse:
    message = str(exc.orig) if exc.orig else str(exc)
    if "does not exist" in message or "UndefinedColumn" in message:
        logger.exception("Database schema error")
        return JSONResponse(
            status_code=503,
            content={"detail": SCHEMA_OUTDATED_DETAIL},
        )
    logger.exception("Database programming error")
    return JSONResponse(status_code=500, content={"detail": "Database error"})


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db_status = check_database(db)
    schema = check_schema_columns(db) if db_status["connected"] else {"ok": False, "missing": []}
    healthy = db_status["connected"] and schema["ok"]
    payload: dict = {
        "status": "ok" if healthy else "degraded",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }
    if not schema["ok"]:
        payload["schema"] = {"ok": False, "missing": schema["missing"]}
    if settings.ENVIRONMENT == "local":
        payload["database"] = db_status
        payload["schema"] = schema
    return payload
