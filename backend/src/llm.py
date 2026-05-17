"""Thin client for CLōD (OpenAI-compatible chat completions).

Used by feature modules to call any of CLōD's hosted models via a single
API key. All callers should be resilient to ``chat`` returning ``None`` so
that the app degrades gracefully when ``CLOD_API_KEY`` is missing or the
upstream is unreachable.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "anthropic/claude-3-haiku-20240307"
DEFAULT_BASE_URL = "https://api.clod.io/v1"
DEFAULT_TIMEOUT = 6


def _config():
    return {
        "api_key": os.getenv("CLOD_API_KEY", "").strip().strip('"'),
        "base_url": os.getenv("CLOD_BASE_URL", DEFAULT_BASE_URL).rstrip("/"),
        "model": os.getenv("CLOD_MODEL", DEFAULT_MODEL),
    }


def _truthy(value: str) -> bool:
    return value.strip().lower() in ("1", "true", "yes", "on")


def is_enabled() -> bool:
    """LLM is on only when both an API key is set AND the global flag is on.

    The flag (``CLOD_ENABLED``) lets demos turn the LLM off without removing
    the key from ``.env``. Defaults to off so the contribution flow stays
    snappy when nobody has explicitly opted in.
    """
    if not _truthy(os.getenv("CLOD_ENABLED", "")):
        return False
    return bool(_config()["api_key"])


def chat(
    messages: list[dict],
    *,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: int = 600,
    response_format: Optional[str] = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> Optional[str]:
    """Send a chat completion request. Returns the assistant's message text,
    or ``None`` on any error so callers can fall back to non-LLM behavior.

    Pass ``response_format="json"`` to coerce a JSON object response (the
    helper will request OpenAI's ``json_object`` format).
    """

    cfg = _config()
    if not cfg["api_key"]:
        logger.warning("CLOD_API_KEY missing; skipping LLM call")
        return None

    payload: dict[str, Any] = {
        "model": model or cfg["model"],
        "messages": messages,
        "max_completion_tokens": max_tokens,
    }
    if temperature is not None:
        payload["temperature"] = temperature
    if response_format == "json":
        payload["response_format"] = {"type": "json_object"}

    request = Request(
        f"{cfg['base_url']}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {cfg['api_key']}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "OpenSauce/1.0 (+https://opensauce.ai)",
        },
    )

    try:
        with urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        logger.warning("CLōD HTTP %s: %s", exc.code, exc.read()[:300])
        return None
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        logger.warning("CLōD request failed: %s", exc)
        return None

    try:
        return body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        logger.warning("Unexpected CLōD response shape: %s", str(body)[:300])
        return None


def chat_json(messages: list[dict], **kwargs) -> Optional[dict]:
    """Convenience wrapper that asks the model for JSON and parses it.

    Returns ``None`` if the call fails or the response is not valid JSON.
    """

    raw = chat(messages, response_format="json", **kwargs)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        logger.warning("CLōD returned non-JSON content: %s", raw[:300])
        return None
