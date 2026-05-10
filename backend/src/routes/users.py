import sqlite3

from flask import Blueprint, g, jsonify, request

from ..auth import create_token, hash_password, require_auth, verify_password
from ..db import get_connection, row_to_dict, transaction
from ..responses import error, require_fields


users_bp = Blueprint("users", __name__)


@users_bp.get("/me")
@require_auth
def me():
    return jsonify({"authenticated": True, "user": g.current_user})


@users_bp.post("/user")
def create_user():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["name", "username", "password"])
    if missing:
        return error(missing)

    try:
        with transaction() as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (name, username, password_hash)
                VALUES (?, ?, ?)
                """,
                (data["name"], data["username"], hash_password(data["password"])),
            )
            user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        return error("Username already exists", 409)

    return jsonify(
        {
            "id": user_id,
            "name": data["name"],
            "username": data["username"],
        }
    ), 201


@users_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["username", "password"])
    if missing:
        return error(missing)

    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, name, username, password_hash FROM users WHERE username = ?",
            (data["username"],),
        ).fetchone()

    if user is None or not verify_password(user["password_hash"], data["password"]):
        return error("Invalid username or password", 401)

    user_data = row_to_dict(user)
    user_data.pop("password_hash", None)
    return jsonify({"oauth_token": create_token(user), "token_type": "Bearer", "user": user_data})
