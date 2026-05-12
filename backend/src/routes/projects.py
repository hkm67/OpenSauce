import psycopg
from flask import Blueprint, jsonify, request

from ..auth import require_auth
from ..db import get_connection, row_to_dict, transaction
from ..responses import error, require_fields


projects_bp = Blueprint("projects", __name__)


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
    except psycopg.errors.UniqueViolation:
        return error("Project URL already exists", 409)

    return jsonify(
        {"id": project_id, "url": data["url"], "description": data["description"]}
    ), 201


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
