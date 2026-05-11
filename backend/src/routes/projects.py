import json
import sqlite3

from flask import Blueprint, g, jsonify, request

from .. import llm
from ..auth import require_auth
from ..db import get_connection, row_to_dict, transaction
from ..responses import error, require_fields


projects_bp = Blueprint("projects", __name__)


def _load_user_preferences(connection, user_id):
    row = connection.execute(
        "SELECT preferences FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    if not row or not row["preferences"]:
        return {"categories": [], "notes": ""}
    try:
        data = json.loads(row["preferences"])
    except (TypeError, ValueError):
        return {"categories": [], "notes": ""}
    return {
        "categories": list(data.get("categories") or []),
        "notes": str(data.get("notes") or ""),
    }


def _user_skill_names(connection, user_id, limit=15):
    rows = connection.execute(
        """
        SELECT name FROM achievements
        WHERE user_id = ? AND name IS NOT NULL AND name != ''
        ORDER BY id DESC
        LIMIT ?
        """,
        (user_id, limit),
    ).fetchall()
    return [row["name"] for row in rows]


@projects_bp.get("/projects")
def list_projects():
    with get_connection() as connection:
        projects = connection.execute(
            """
            SELECT id, url, description, created_at
            FROM projects
            ORDER BY id DESC
            """
        ).fetchall()

    return jsonify({"projects": [row_to_dict(project) for project in projects]})


@projects_bp.post("/project")
@require_auth
def create_project():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["url", "description"])
    if missing:
        return error(missing)

    try:
        with transaction() as connection:
            cursor = connection.execute(
                """
                INSERT INTO projects (url, description)
                VALUES (?, ?)
                """,
                (data["url"], data["description"]),
            )
            project_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        return error("Project URL already exists", 409)

    return jsonify(
        {"id": project_id, "url": data["url"], "description": data["description"]}
    ), 201


@projects_bp.post("/projects/recommend")
@require_auth
def recommend_projects():
    data = request.get_json(silent=True) or {}
    extra_query = str(data.get("query") or "").strip()
    limit = max(1, min(int(data.get("limit") or 5), 10))

    with get_connection() as connection:
        prefs = _load_user_preferences(connection, g.current_user["id"])
        skills = _user_skill_names(connection, g.current_user["id"])
        projects = connection.execute(
            "SELECT id, url, description FROM projects ORDER BY id"
        ).fetchall()

    project_data = [row_to_dict(p) for p in projects]
    if not project_data or not llm.is_enabled():
        return jsonify({"recommendations": [], "enabled": llm.is_enabled()})

    catalog_lines = "\n".join(
        f"{p['id']}. [{p['url']}] {p['description'][:200]}" for p in project_data
    )
    prefs_line = (
        f"Preferred categories: {', '.join(prefs['categories']) or 'none specified'}.\n"
        f"Notes from contributor: {prefs['notes'] or 'none'}."
    )
    skills_line = (
        f"Recent skills/tags: {', '.join(skills) or 'no past contributions yet'}."
    )
    query_line = f"\nAd-hoc focus for this request: {extra_query}" if extra_query else ""

    response = llm.chat_json(
        [
            {
                "role": "system",
                "content": (
                    "You recommend open source projects to a contributor. "
                    "Pick the best matches from the provided catalog. Respond ONLY "
                    "with JSON of shape {\"recommendations\": "
                    "[{\"project_id\": <int>, \"reason\": <one short sentence>}]}. "
                    f"Return at most {limit} items, ranked best first."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"{prefs_line}\n{skills_line}{query_line}\n\n"
                    f"Catalog (id. [url] description):\n{catalog_lines}"
                ),
            },
        ],
        max_tokens=600,
    )

    if not isinstance(response, dict):
        return jsonify({"recommendations": [], "enabled": True})

    valid_ids = {p["id"] for p in project_data}
    recs = []
    for item in response.get("recommendations") or []:
        if not isinstance(item, dict):
            continue
        try:
            pid = int(item.get("project_id"))
        except (TypeError, ValueError):
            continue
        if pid not in valid_ids:
            continue
        reason = item.get("reason")
        recs.append(
            {
                "project_id": pid,
                "reason": reason.strip() if isinstance(reason, str) else "",
            }
        )
        if len(recs) >= limit:
            break

    return jsonify({"recommendations": recs, "enabled": True})


@projects_bp.delete("/project")
@require_auth
def delete_project():
    data = request.get_json(silent=True) or {}
    project_id = data.get("id")
    project_url = data.get("url")

    if not project_id and not project_url:
        return error("Provide either id or url")

    with transaction() as connection:
        if project_id:
            cursor = connection.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        else:
            cursor = connection.execute("DELETE FROM projects WHERE url = ?", (project_url,))

    if cursor.rowcount == 0:
        return error("Project not found", 404)

    return jsonify({"deleted": True})
