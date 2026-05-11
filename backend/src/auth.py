from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from .config import AUTH_COOKIE_NAME, SECRET_KEY, TOKEN_EXPIRES_SECONDS
from .db import get_connection, row_to_dict


def hash_password(password):
    return generate_password_hash(password, method='pbkdf2:sha256')


def verify_password(password_hash, password):
    return check_password_hash(password_hash, password)


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


def decode_token(token):
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])


def _get_bearer_payload():
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.removeprefix("Bearer ").strip()
    elif AUTH_COOKIE_NAME:
        token = (request.cookies.get(AUTH_COOKIE_NAME) or "").strip()

    if not token:
        return None, (jsonify({"error": "Missing bearer token"}), 401)

    try:
        return decode_token(token), None
    except jwt.ExpiredSignatureError:
        return None, (jsonify({"error": "Token expired"}), 401)
    except jwt.InvalidTokenError:
        return None, (jsonify({"error": "Invalid token"}), 401)


def _load_user(user_id):
    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, name, username FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return row_to_dict(user)


def require_auth(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        payload, auth_error = _get_bearer_payload()
        if auth_error:
            return auth_error

        if payload.get("scope", "user") != "user":
            return jsonify({"error": "Token cannot access this endpoint"}), 403

        user = _load_user(payload["sub"])
        if user is None:
            return jsonify({"error": "User not found"}), 401

        g.current_user = user
        g.auth_scope = payload.get("scope", "user")
        g.token_payload = payload
        return handler(*args, **kwargs)

    return wrapper


def require_achievement_auth(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        payload, auth_error = _get_bearer_payload()
        if auth_error:
            return auth_error

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
