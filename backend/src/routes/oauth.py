import urllib.parse
import base64
import hashlib
import secrets

from flask import Blueprint, jsonify, redirect, request, session

from ..auth import create_token
from ..config import GITHUB_REDIRECT_URI, OAUTH_SUCCESS_REDIRECT, SUPABASE_URL
from ..rate_limit import rate_limit
from ..responses import error
from .users import supabase_auth_request, upsert_profile


oauth_bp = Blueprint("oauth", __name__)


def _profile_from_supabase_user(auth_user):
    metadata = auth_user.get("user_metadata") or {}
    email = auth_user.get("email") or ""
    name = (
        metadata.get("name")
        or metadata.get("full_name")
        or metadata.get("user_name")
        or metadata.get("preferred_username")
        or email.split("@")[0]
        or "OpenSauce User"
    )
    username = (
        metadata.get("user_name")
        or metadata.get("preferred_username")
        or metadata.get("name")
        or email.split("@")[0]
        or auth_user["id"][:8]
    )
    username = str(username).strip().replace(" ", "-").lower()
    return str(name).strip(), username


def _pkce_challenge(verifier):
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


@oauth_bp.get("/oauth/github")
@rate_limit("auth")
def github_authorize():
    if not SUPABASE_URL:
        return error("Supabase is not configured.", 503)

    verifier = secrets.token_urlsafe(64)
    session["oauth_code_verifier"] = verifier
    query = urllib.parse.urlencode(
        {
            "provider": "github",
            "redirect_to": GITHUB_REDIRECT_URI,
            "code_challenge": _pkce_challenge(verifier),
            "code_challenge_method": "s256",
        }
    )
    return redirect(f"{SUPABASE_URL.rstrip('/')}/auth/v1/authorize?{query}", 302)


@oauth_bp.get("/oauth/github/callback")
@rate_limit("auth")
def github_callback():
    code = request.args.get("code")
    code_verifier = session.pop("oauth_code_verifier", None)

    if not code:
        return error("Missing OAuth code.", 400)
    if not code_verifier:
        return error("OAuth verifier was lost.", 400)

    try:
        auth_payload = supabase_auth_request(
            "/auth/v1/token?grant_type=pkce",
            {"auth_code": code, "code_verifier": code_verifier},
        )
    except (RuntimeError, ValueError) as exc:
        return error(str(exc), 400)

    auth_user = auth_payload.get("user") or {}
    access_token = auth_payload.get("access_token")
    if not auth_user.get("id") or not access_token:
        return error("Supabase did not return an OAuth user.", 502)

    name, username = _profile_from_supabase_user(auth_user)
    user = upsert_profile(auth_user["id"], name, username)
    if user is None:
        user = upsert_profile(auth_user["id"], name, f"{username}-{auth_user['id'][:8]}")
    if user is None:
        return error("Username already exists", 409)

    token = create_token(user)
    target = OAUTH_SUCCESS_REDIRECT.split("#", 1)[0]
    fragment = urllib.parse.urlencode(
        {"access_token": token, "token_type": "Bearer"},
        quote_via=urllib.parse.quote,
    )
    return redirect(f"{target}#{fragment}", 302)


@oauth_bp.post("/logout")
@rate_limit("api")
def logout():
    return jsonify({"logged_out": True})
