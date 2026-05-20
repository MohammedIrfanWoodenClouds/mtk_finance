from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

_engine_kwargs: dict = {
    "pool_pre_ping": True,
    "connect_args": {"connect_timeout": 15},
}
if settings.VERCEL_ENV:
    # Serverless: one connection per invocation, no pooled idle connections
    _engine_kwargs["poolclass"] = NullPool
else:
    _engine_kwargs["pool_size"] = 5
    _engine_kwargs["max_overflow"] = 10

engine = create_engine(settings.sqlalchemy_database_uri, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
