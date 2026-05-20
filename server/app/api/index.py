"""Vercel serverless entrypoint for FastAPI (ASGI app)."""
import sys
from pathlib import Path

# Ensure `app` package resolves when PYTHONPATH is not preset (Vercel build/runtime).
_server_dir = Path(__file__).resolve().parents[2]
if str(_server_dir) not in sys.path:
    sys.path.insert(0, str(_server_dir))

from app.main import app  # noqa: F401
