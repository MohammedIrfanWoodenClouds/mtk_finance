"""Vercel Python entrypoint (must live under /api for serverless detection)."""
import sys
from pathlib import Path

_server = Path(__file__).resolve().parent.parent / "server"
if str(_server) not in sys.path:
    sys.path.insert(0, str(_server))

from app.main import app  # noqa: F401
