from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from .config import AUTH_COOKIE_NAME, SECRET_KEY, TOKEN_EXPIRES_SECONDS
from .db import get_connection, row_to_dict


def hash_password(password):
    return generate_password_hash(password)


def verify_password(password_hash, password):
    return check_password_hash(password_hash, password)


def create_token(user):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "iat": now,
        "exp": now + timedelta(seconds=TOKEN_EXPIRES_SECONDS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token):
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])


def require_auth(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = None
        if auth_header.startswith("Bearer "):
            token = auth_header.removeprefix("Bearer ").strip()
        elif AUTH_COOKIE_NAME:
            token = (request.cookies.get(AUTH_COOKIE_NAME) or "").strip()

        if not token:
            return jsonify({"error": "Missing bearer token"}), 401
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        with get_connection() as connection:
            user = connection.execute(
                "SELECT id, name, username FROM users WHERE id = ?",
                (payload["sub"],),
            ).fetchone()

        if user is None:
            return jsonify({"error": "User not found"}), 401

        g.current_user = row_to_dict(user)
        return handler(*args, **kwargs)

    return wrapper
