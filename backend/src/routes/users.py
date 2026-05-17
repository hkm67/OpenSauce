import json
import uuid
import urllib.error
import urllib.parse
import urllib.request
from urllib.request import Request, urlopen

import psycopg
from flask import Blueprint, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from ..auth import create_token, require_auth
from ..cache import cache_delete_prefix, cache_get, cache_set
from ..config import LOCAL_AUTH_ENABLED, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL
from ..db import get_connection, row_to_dict, transaction
from ..rate_limit import rate_limit
from ..responses import error, require_fields


users_bp = Blueprint("users", __name__)


def _load_preferences(raw):
    if not raw:
        return {"categories": [], "notes": ""}
    if isinstance(raw, dict):
        data = raw
    else:
        try:
            data = json.loads(raw)
        except (TypeError, ValueError):
            return {"categories": [], "notes": ""}
    return {
        "categories": list(data.get("categories") or []),
        "notes": str(data.get("notes") or ""),
    }


def _supabase_request(path, payload):
    return supabase_auth_request(path, payload)


def _local_signup(email, password, name, username):
    user_id = str(uuid.uuid4())
    metadata = json.dumps({"name": name, "username": username})
    try:
        with transaction() as connection:
            connection.execute(
                """
                INSERT INTO auth.users (id, email, password_hash, raw_user_meta_data)
                VALUES (?, ?, ?, ?::jsonb)
                """,
                (user_id, email, generate_password_hash(password, method="pbkdf2:sha256"), metadata),
            )
    except psycopg.errors.UniqueViolation as exc:
        raise ValueError("Email already exists") from exc
    return {"user": {"id": user_id, "email": email}}


def _local_login(email, password):
    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, email, password_hash FROM auth.users WHERE email = ?",
            (email,),
        ).fetchone()
    if user is None or not user["password_hash"] or not check_password_hash(user["password_hash"], password):
        raise ValueError("Invalid email or password")
    return {"user": {"id": str(user["id"]), "email": user["email"]}}


def _auth_request(path, payload):
    if LOCAL_AUTH_ENABLED:
        if path == "/auth/v1/signup":
            data = payload.get("data") or {}
            return _local_signup(
                payload["email"],
                payload["password"],
                data.get("name") or payload["email"].split("@", 1)[0],
                data.get("username") or payload["email"].split("@", 1)[0],
            )
        if path == "/auth/v1/token?grant_type=password":
            return _local_login(payload["email"], payload["password"])
    return _supabase_request(path, payload)


def supabase_auth_request(path, payload, bearer_token=None):
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required")

    data = json.dumps(payload).encode("utf-8")
    req = Request(f"{SUPABASE_URL.rstrip('/')}{path}", data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("apikey", SUPABASE_PUBLISHABLE_KEY)
    req.add_header("Authorization", f"Bearer {bearer_token or SUPABASE_PUBLISHABLE_KEY}")
    try:
        with urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = {"msg": raw or exc.reason}
        message = body.get("msg") or body.get("message") or body.get("error_description") or body.get("error") or "Supabase Auth request failed"
        raise ValueError(message) from exc


def upsert_profile(user_id, name, username):
    try:
        with transaction() as connection:
            if LOCAL_AUTH_ENABLED:
                connection.execute(
                    """
                    INSERT INTO auth.users (id)
                    VALUES (?)
                    ON CONFLICT(id) DO NOTHING
                    """,
                    (user_id,),
                )
            profile = connection.execute(
                """
                INSERT INTO profiles (id, name, username)
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    username = excluded.username
                RETURNING id, name, username
                """,
                (user_id, name, username),
            ).fetchone()
    except psycopg.errors.UniqueViolation:
        return None
    user = row_to_dict(profile)
    cache_delete_prefix(("user", str(user_id)))
    return user


def _profile_exists(username):
    with get_connection() as connection:
        return connection.execute(
            "SELECT id FROM profiles WHERE username = ?",
            (username,),
        ).fetchone() is not None


@users_bp.post("/user")
@rate_limit("auth")
def create_user():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["name", "username", "email", "password"])
    if missing:
        return error(missing)

    if _profile_exists(data["username"]):
        return error("Username already exists", 409)

    try:
        auth_payload = _auth_request(
            "/auth/v1/signup",
            {
                "email": data["email"],
                "password": data["password"],
                "data": {"name": data["name"], "username": data["username"]},
            },
        )
    except (RuntimeError, ValueError) as exc:
        return error(str(exc), 400)

    auth_user = auth_payload.get("user") or auth_payload
    user_id = auth_user.get("id")
    if not user_id:
        return error("Supabase did not return a user id", 502)

    user = upsert_profile(user_id, data["name"], data["username"])
    if user is None:
        return error("Username already exists", 409)

    return jsonify({"oauth_token": create_token(user), "token_type": "Bearer", "user": user}), 201


@users_bp.post("/login")
@rate_limit("auth")
def login():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["email", "password"])
    if missing:
        return error(missing)

    try:
        auth_payload = _auth_request(
            "/auth/v1/token?grant_type=password",
            {"email": data["email"], "password": data["password"]},
        )
    except (RuntimeError, ValueError):
        return error("Invalid email or password", 401)

    auth_user = auth_payload.get("user") or {}
    user_id = auth_user.get("id")
    if not user_id:
        return error("Invalid email or password", 401)

    with get_connection() as connection:
        profile = connection.execute(
            "SELECT id, name, username FROM profiles WHERE id = ?",
            (user_id,),
        ).fetchone()
    if profile is None:
        return error("User profile not found", 401)

    user = row_to_dict(profile)
    return jsonify({"oauth_token": create_token(user), "token_type": "Bearer", "user": user})


@users_bp.get("/user")
@require_auth
@rate_limit("api")
def current_user():
    return jsonify({"authenticated": True, "user": g.current_user})


@users_bp.get("/preferences")
@require_auth
@rate_limit("api")
def get_preferences():
    cache_key = ("preferences", str(g.current_user["id"]))
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify({"preferences": cached})

    with get_connection() as connection:
        row = connection.execute(
            "SELECT preferences FROM profiles WHERE id = ?",
            (g.current_user["id"],),
        ).fetchone()
    preferences = _load_preferences(row["preferences"] if row else None)
    cache_set(cache_key, preferences)
    return jsonify({"preferences": preferences})


@users_bp.put("/preferences")
@require_auth
@rate_limit("api")
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
            "UPDATE profiles SET preferences = ?::jsonb WHERE id = ?",
            (payload, g.current_user["id"]),
        )

    preferences = _load_preferences(payload)
    cache_delete_prefix(("preferences", str(g.current_user["id"])))
    cache_set(("preferences", str(g.current_user["id"])), preferences)
    return jsonify({"preferences": preferences})
