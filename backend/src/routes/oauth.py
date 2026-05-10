import json
import secrets
import urllib.error
import urllib.parse
import urllib.request
from urllib.request import Request, urlopen

from flask import Blueprint, jsonify, make_response, redirect, request, session

from ..auth import create_token, hash_password
from ..config import (
    AUTH_COOKIE_NAME,
    AUTH_COOKIE_SECURE,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_REDIRECT_URI,
    OAUTH_JSON_RESPONSE,
    OAUTH_SUCCESS_REDIRECT,
    OAUTH_TOKEN_IN_FRAGMENT,
    TOKEN_EXPIRES_SECONDS,
)
from ..db import row_to_dict, transaction
from ..responses import error

oauth_bp = Blueprint("oauth", __name__)


def _post_form(url, form):
    data = urllib.parse.urlencode(form).encode()
    req = Request(url, data=data, method="POST")
    req.add_header("Accept", "application/json")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"error": raw or e.reason}


def _get_github_user(access_token):
    url = "https://api.github.com/user"
    req = Request(url, method="GET")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("Authorization", f"Bearer {access_token}")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def _upsert_user_from_github(github_user):
    gid = int(github_user["id"])
    login = github_user["login"]
    name = (github_user.get("name") or "").strip() or login

    with transaction() as connection:
        row = connection.execute(
            "SELECT id, name, username, github_id FROM users WHERE github_id = ?",
            (gid,),
        ).fetchone()
        if row:
            if row["name"] != name:
                connection.execute(
                    "UPDATE users SET name = ? WHERE id = ?",
                    (name, row["id"]),
                )
            out = connection.execute(
                "SELECT id, name, username FROM users WHERE id = ?",
                (row["id"],),
            ).fetchone()
            return row_to_dict(out)

        row = connection.execute(
            "SELECT id, name, username, github_id FROM users WHERE username = ?",
            (login,),
        ).fetchone()
        if row:
            if row["github_id"] is not None and row["github_id"] != gid:
                raise ValueError("This GitHub account does not match the user linked to this username.")
            if row["github_id"] is None:
                connection.execute(
                    "UPDATE users SET github_id = ?, name = ? WHERE id = ?",
                    (gid, name, row["id"]),
                )
            else:
                connection.execute(
                    "UPDATE users SET name = ? WHERE id = ?",
                    (name, row["id"]),
                )
            out = connection.execute(
                "SELECT id, name, username FROM users WHERE id = ?",
                (row["id"],),
            ).fetchone()
            return row_to_dict(out)

        password_hash = hash_password(secrets.token_urlsafe(32))
        cur = connection.execute(
            """
            INSERT INTO users (name, username, password_hash, github_id)
            VALUES (?, ?, ?, ?)
            """,
            (name, login, password_hash, gid),
        )
        uid = cur.lastrowid
        out = connection.execute(
            "SELECT id, name, username FROM users WHERE id = ?",
            (uid,),
        ).fetchone()
        return row_to_dict(out)


@oauth_bp.get("/oauth/github")
def github_authorize():
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        return error(
            "GitHub OAuth is not configured (set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET).",
            503,
        )
    state = secrets.token_hex(16)
    session["oauth_state"] = state
    q = urllib.parse.urlencode(
        {
            "client_id": GITHUB_CLIENT_ID,
            "redirect_uri": GITHUB_REDIRECT_URI,
            "scope": "read:user",
            "state": state,
        }
    )
    return redirect(f"https://github.com/login/oauth/authorize?{q}")


@oauth_bp.get("/oauth/github/callback")
def github_callback():
    err = request.args.get("error")
    if err:
        desc = request.args.get("error_description", "")
        return error(f"GitHub error: {err} {desc}".strip(), 400)

    code = request.args.get("code")
    state = request.args.get("state")
    expected = session.pop("oauth_state", None)
    if not code or not state:
        return error("Invalid OAuth state or missing code.", 400)
    if expected is None:
        return error(
            "OAuth session was lost (no state in session). Use http://localhost:8000 "
            "for the whole flow and set GITHUB_REDIRECT_URI and GitHub’s callback URL "
            "to http://localhost:8000/oauth/github/callback. "
            "Visiting 127.0.0.1 should redirect to localhost automatically.",
            400,
        )
    if state != expected:
        return error("Invalid OAuth state.", 400)

    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        return error("GitHub OAuth is not configured.", 503)

    token_payload = _post_form(
        "https://github.com/login/oauth/access_token",
        {
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": GITHUB_REDIRECT_URI,
        },
    )
    if token_payload.get("error"):
        return error(
            token_payload.get("error_description") or token_payload["error"],
            400,
        )
    access_token = token_payload.get("access_token")
    if not access_token:
        return error("No access token from GitHub.", 400)

    try:
        gh_user = _get_github_user(access_token)
    except urllib.error.HTTPError as e:
        return error(e.read().decode() or str(e.reason), 502)
    except (urllib.error.URLError, json.JSONDecodeError, KeyError) as e:
        return error(str(e), 502)

    try:
        user = _upsert_user_from_github(gh_user)
    except ValueError as e:
        return error(str(e), 409)

    token = create_token(user)

    if OAUTH_JSON_RESPONSE:
        return jsonify(
            {
                "oauth_token": token,
                "token_type": "Bearer",
                "user": user,
            }
        )

    if OAUTH_SUCCESS_REDIRECT:
        target = OAUTH_SUCCESS_REDIRECT.strip()
        if OAUTH_TOKEN_IN_FRAGMENT:
            base_url = target.split("#", 1)[0]
            frag = urllib.parse.urlencode(
                {"access_token": token, "token_type": "Bearer"},
                quote_via=urllib.parse.quote,
            )
            target = f"{base_url}#{frag}"
    else:
        target = request.url_root.rstrip("/") + "/oauth/welcome"

    resp = make_response(redirect(target, 302))
    resp.set_cookie(
        AUTH_COOKIE_NAME,
        token,
        max_age=TOKEN_EXPIRES_SECONDS,
        httponly=True,
        samesite="Lax",
        secure=AUTH_COOKIE_SECURE,
        path="/",
    )
    return resp


@oauth_bp.get("/oauth/welcome")
def oauth_welcome():
    """Shown after GitHub login when OAUTH_SUCCESS_REDIRECT is not set."""
    return (
        "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><title>Signed in</title></head>"
        "<body><h1>Signed in</h1>"
        "<p>An HttpOnly cookie was set for this API origin. "
        "Call protected routes from this site with <code>credentials: 'include'</code>, "
        "or use <code>Authorization: Bearer …</code> from scripts and CLIs.</p>"
        "<p><a href='/'>Home</a></p></body></html>"
    )


@oauth_bp.post("/logout")
def logout():
    resp = make_response(jsonify({"ok": True}))
    resp.delete_cookie(AUTH_COOKIE_NAME, path="/")
    return resp
