from flask import Blueprint, g, jsonify, request

from ..auth import require_auth
from ..db import get_connection, row_to_dict, transaction
from ..responses import error, require_fields


activities_bp = Blueprint("activities", __name__)


@activities_bp.post("/activity")
@require_auth
def add_activity():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["opensource_id", "url"])
    if missing:
        return error(missing)

    with transaction() as connection:
        project = connection.execute(
            "SELECT id FROM projects WHERE id = ?",
            (data["opensource_id"],),
        ).fetchone()
        if project is None:
            return error("Project not found", 404)

        cursor = connection.execute(
            """
            INSERT INTO activities (user_id, opensource_id, url)
            VALUES (?, ?, ?)
            """,
            (g.current_user["id"], data["opensource_id"], data["url"]),
        )
        activity = connection.execute(
            """
            SELECT id, user_id, opensource_id, timestamp, url
            FROM activities
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()

    return jsonify({"activity": row_to_dict(activity)}), 201
