from flask import Blueprint, g, jsonify, request

from ..auth import require_auth
from ..db import get_connection, row_to_dict, transaction
from ..github import normalize_github_repo
from ..responses import error, require_fields


activities_bp = Blueprint("activities", __name__)


@activities_bp.post("/activity")
@require_auth
def add_activity():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["github_repo"])
    if missing:
        return error(missing)

    github_repo = normalize_github_repo(data.get("github_repo"))
    if not github_repo:
        return error("github_repo must be a GitHub repository like owner/repo")

    activity_type = data.get("type", "started")
    if activity_type not in {"started", "submitted", "merged", "closed", "synced"}:
        return error("type must be one of: started, submitted, merged, closed, synced")

    with transaction() as connection:
        cursor = connection.execute(
            """
            INSERT INTO activities (user_id, github_repo, type, url)
            VALUES (?, ?, ?, ?)
            """,
            (g.current_user["id"], github_repo, activity_type, data.get("url")),
        )
        activity = connection.execute(
            """
            SELECT id, user_id, github_repo, type, timestamp, url
            FROM activities
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()

    return jsonify({"activity": row_to_dict(activity)}), 201
