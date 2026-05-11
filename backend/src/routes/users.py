import json
import sqlite3

from flask import Blueprint, g, jsonify, request

from ..auth import create_token, hash_password, require_auth, verify_password
from ..db import get_connection, row_to_dict, transaction
from ..responses import error, require_fields


users_bp = Blueprint("users", __name__)


def _load_preferences(raw):
    if not raw:
        return {"categories": [], "notes": ""}
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return {"categories": [], "notes": ""}
    return {
        "categories": list(data.get("categories") or []),
        "notes": str(data.get("notes") or ""),
    }


@users_bp.get("/user")
@require_auth
def current_user():
    return jsonify({"authenticated": True, "user": g.current_user})


@users_bp.get("/preferences")
@require_auth
def get_preferences():
    with get_connection() as connection:
        row = connection.execute(
            "SELECT preferences FROM users WHERE id = ?",
            (g.current_user["id"],),
        ).fetchone()
    return jsonify({"preferences": _load_preferences(row["preferences"] if row else None)})


@users_bp.put("/preferences")
@require_auth
def set_preferences():
    data = request.get_json(silent=True) or {}

    categories = data.get("categories", [])
    if not isinstance(categories, list) or not all(isinstance(c, str) for c in categories):
        return error("categories must be a list of strings")
    notes = data.get("notes", "")
    if not isinstance(notes, str):
        return error("notes must be a string")

    payload = json.dumps({"categories": categories[:20], "notes": notes[:1000]})
    with transaction() as connection:
        connection.execute(
            "UPDATE users SET preferences = ? WHERE id = ?",
            (payload, g.current_user["id"]),
        )

    return jsonify({"preferences": _load_preferences(payload)})


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
