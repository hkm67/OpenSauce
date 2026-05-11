import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

BASE_DIR = Path(__file__).resolve().parent.parent
if load_dotenv:
    load_dotenv(BASE_DIR / ".env")

DATABASE_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "opensauce.db"))
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
TOKEN_EXPIRES_SECONDS = int(os.getenv("TOKEN_EXPIRES_SECONDS", "86400"))

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv(
    "GITHUB_REDIRECT_URI",
    "http://localhost:8000/oauth/github/callback",
)
# After GitHub login: 302 here (no JWT in query string). Set in production to your real app.
OAUTH_SUCCESS_REDIRECT = os.getenv("OAUTH_SUCCESS_REDIRECT", "")
# If 1, append #access_token=...&token_type=Bearer for SPAs on another origin (localhost:3000 vs :8000).
OAUTH_TOKEN_IN_FRAGMENT = os.getenv("OAUTH_TOKEN_IN_FRAGMENT", "").lower() in (
    "1",
    "true",
    "yes",
)
# HttpOnly cookie on the API host so same-origin browser requests stay authenticated without Bearer header.
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "opensauce_token")
# Set to 1 in production behind HTTPS (Secure cookies).
AUTH_COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "").lower() in ("1", "true", "yes")
# Dev-only: return JSON from the callback instead of redirecting (local API testing).
OAUTH_JSON_RESPONSE = os.getenv("OAUTH_JSON_RESPONSE", "").lower() in ("1", "true", "yes")
# Local frontend origin allowed to call the API with the HttpOnly auth cookie.
CORS_ALLOWED_ORIGIN = os.getenv("CORS_ALLOWED_ORIGIN", "http://localhost:3000")
# Public-facing base URL of this API (no trailing slash).
# Set to the deployed domain so generated URLs (magic_url, /achieve in SKILL.md)
# use the real host instead of the internal container address.
# Defaults to empty string — the code falls back to Flask's request.url_root.
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
