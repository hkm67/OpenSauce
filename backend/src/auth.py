from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import g, jsonify, request

from .config import AUTH_COOKIE_NAME, SECRET_KEY, TOKEN_EXPIRES_SECONDS
from .db import get_connection, row_to_dict


def create_temporary_achievement_token(
    user_id, projects, assigned_issue=None, expires_seconds=3600
):
    now = datetime.now(timezone.utc)
    token_projects = [
        {
            "id": project["id"],
            "url": project["url"],
            "description": project["description"],
        }
        for project in projects
    ]
    payload = {
        "sub": str(user_id),
        "scope": "achievement",
        "projects": token_projects,
        "project_ids": [project["id"] for project in token_projects],
        "assigned_issue": assigned_issue,
        "iat": now,
        "exp": now + timedelta(seconds=expires_seconds),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def create_token(user):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "scope": "user",
        "iat": now,
        "exp": now + timedelta(seconds=TOKEN_EXPIRES_SECONDS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_temporary_token(token):
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])


def decode_backend_token(token):
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])


def _get_bearer_token():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.removeprefix("Bearer ").strip()
    if AUTH_COOKIE_NAME:
        return (request.cookies.get(AUTH_COOKIE_NAME) or "").strip()
    return ""


def _load_user(user_id):
    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, name, username FROM profiles WHERE id = ?",
            (user_id,),
        ).fetchone()
    return row_to_dict(user)


def _decode_user_payload(token):
    try:
        payload = decode_backend_token(token)
    except jwt.ExpiredSignatureError:
        return None, (jsonify({"error": "Token expired"}), 401)
    except jwt.InvalidTokenError:
        return None, (jsonify({"error": "Invalid token"}), 401)

    if not payload.get("sub"):
        return None, (jsonify({"error": "Invalid token"}), 401)
    if payload.get("scope", "user") != "user":
        return None, (jsonify({"error": "Token cannot access this endpoint"}), 403)
    return payload, None


def require_auth(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        token = _get_bearer_token()
        if not token:
            return jsonify({"error": "Missing bearer token"}), 401

        payload, auth_error = _decode_user_payload(token)
        if auth_error:
            return auth_error

        user = _load_user(payload["sub"])
        if user is None:
            return jsonify({"error": "User not found"}), 401

        g.current_user = user
        g.auth_scope = "user"
        g.token_payload = payload
        return handler(*args, **kwargs)

    return wrapper


def require_achievement_auth(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        token = _get_bearer_token()
        if not token:
            return jsonify({"error": "Missing bearer token"}), 401

        try:
            payload = decode_backend_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        scope = payload.get("scope", "user")
        if scope not in {"user", "achievement"}:
            return jsonify({"error": "Token cannot record achievements"}), 403

        user = _load_user(payload["sub"])
        if user is None:
            return jsonify({"error": "User not found"}), 401

        g.current_user = user
        g.auth_scope = scope
        g.token_payload = payload
        return handler(*args, **kwargs)

    return wrapper
