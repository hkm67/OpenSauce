import os
from pathlib import Path
from urllib.parse import quote

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

BASE_DIR = Path(__file__).resolve().parent.parent
if load_dotenv:
    load_dotenv(BASE_DIR / ".env")


LEGACY_ENV_VARS = ("DATABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_JWT_SECRET")
_present_legacy_env = [name for name in LEGACY_ENV_VARS if os.getenv(name)]
if _present_legacy_env:
    raise RuntimeError(
        "Remove unsupported legacy environment variable(s): "
        + ", ".join(_present_legacy_env)
        + ". Use DB_URL_TEMPLATE, DB_PASSWORD, and SUPABASE_PUBLISHABLE_KEY instead."
    )


def _build_database_url():
    template = os.getenv("DB_URL_TEMPLATE", "").strip()
    password = os.getenv("DB_PASSWORD", "")

    if not template or not password:
        return ""
    if "[YOUR-PASSWORD]" not in template:
        raise RuntimeError("DB_URL_TEMPLATE must include the literal [YOUR-PASSWORD] placeholder.")

    return template.replace("[YOUR-PASSWORD]", quote(password, safe=""))


DB_DSN = _build_database_url()
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
TOKEN_EXPIRES_SECONDS = int(os.getenv("TOKEN_EXPIRES_SECONDS", "86400"))
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
GITHUB_REDIRECT_URI = os.getenv(
    "GITHUB_REDIRECT_URI",
    "http://localhost:8000/oauth/github/callback",
)
OAUTH_SUCCESS_REDIRECT = os.getenv(
    "OAUTH_SUCCESS_REDIRECT",
    "http://localhost:3000/oauth/callback",
)

AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "opensauce_token")


def _cors_allowed_origins():
    raw_origins = os.getenv("CORS_ALLOWED_ORIGINS")
    if raw_origins is None:
        raw_origins = os.getenv("CORS_ALLOWED_ORIGIN", "http://localhost:3000,http://127.0.0.1:3000")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

    # Keep local development forgiving even when an older .env only sets the
    # singular localhost origin.
    local_pairs = {
        "http://localhost:3000": "http://127.0.0.1:3000",
        "http://127.0.0.1:3000": "http://localhost:3000",
    }
    for origin, paired_origin in local_pairs.items():
        if origin in origins and paired_origin not in origins:
            origins.append(paired_origin)
    return origins


# Frontend origins allowed to call the API with browser credentials.
CORS_ALLOWED_ORIGINS = _cors_allowed_origins()
# Public-facing base URL of this API (no trailing slash).
# Set to the deployed domain so generated URLs (magic_url, /achieve in SKILL.md)
# use the real host instead of the internal container address.
# Defaults to empty string — the code falls back to Flask's request.url_root.
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
LOCAL_AUTH_ENABLED = os.getenv("LOCAL_AUTH_ENABLED", "").lower() in ("1", "true", "yes")
GITHUB_CACHE_TTL_SECONDS = int(os.getenv("GITHUB_CACHE_TTL_SECONDS", "300"))
GITHUB_CACHE_MAX_ITEMS = int(os.getenv("GITHUB_CACHE_MAX_ITEMS", "256"))
APP_CACHE_TTL_SECONDS = int(os.getenv("APP_CACHE_TTL_SECONDS", "60"))
APP_CACHE_MAX_ITEMS = int(os.getenv("APP_CACHE_MAX_ITEMS", "512"))
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() not in ("0", "false", "no")
RATE_LIMIT_AUTH_REQUESTS = int(os.getenv("RATE_LIMIT_AUTH_REQUESTS", "10"))
RATE_LIMIT_AUTH_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_AUTH_WINDOW_SECONDS", "60"))
RATE_LIMIT_API_REQUESTS = int(os.getenv("RATE_LIMIT_API_REQUESTS", "120"))
RATE_LIMIT_API_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_API_WINDOW_SECONDS", "60"))
RATE_LIMIT_EXPENSIVE_REQUESTS = int(os.getenv("RATE_LIMIT_EXPENSIVE_REQUESTS", "30"))
RATE_LIMIT_EXPENSIVE_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_EXPENSIVE_WINDOW_SECONDS", "60"))
