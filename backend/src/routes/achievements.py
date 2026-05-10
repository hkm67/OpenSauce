from flask import Blueprint, g, jsonify, request

from ..auth import require_auth
from ..db import get_connection, row_to_dict, transaction
from ..responses import error, require_fields


achievements_bp = Blueprint("achievements", __name__)


@achievements_bp.get("/skill")
@require_auth
def get_skills():
    with get_connection() as connection:
        achievements = connection.execute(
            """
            SELECT id, name, description, created_at
            FROM achievements
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (g.current_user["id"],),
        ).fetchall()

    skills = [
        {
            "id": achievement["id"],
            "skill": achievement["name"],
            "description": achievement["description"],
            "earned_at": achievement["created_at"],
        }
        for achievement in achievements
    ]
    return jsonify({"user": g.current_user, "skills": skills})


@achievements_bp.post("/achieve")
@require_auth
def add_achievement():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["name"])
    if missing:
        return error(missing)

    with transaction() as connection:
        cursor = connection.execute(
            """
            INSERT INTO achievements (user_id, name, description)
            VALUES (?, ?, ?)
            """,
            (g.current_user["id"], data["name"], data.get("description")),
        )
        achievement = connection.execute(
            """
            SELECT id, user_id, name, description, created_at
            FROM achievements
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()

    return jsonify({"achievement": row_to_dict(achievement)}), 201
