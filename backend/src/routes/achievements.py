from flask import Blueprint, g, jsonify, request

from ..auth import create_temporary_achievement_token, require_achievement_auth
from ..db import get_connection, row_to_dict, transaction
from ..responses import error, require_fields


achievements_bp = Blueprint("achievements", __name__)


def _parse_project_ids(data):
    project_ids = data.get("project_ids", data.get("project_id", []))
    if project_ids in (None, ""):
        return []
    if isinstance(project_ids, int):
        project_ids = [project_ids]
    if isinstance(project_ids, str):
        project_ids = [project_ids]

    try:
        return [int(project_id) for project_id in project_ids]
    except (TypeError, ValueError):
        return None


def _build_skill_prompt(projects, achievement_token):
    project_list = "\n".join(
        f"- {project['url']} - {project['description']}" for project in projects
    )
    project_urls = "\n".join(f"- {project['url']}" for project in projects)

    return f"""# Open Source Volunteer Agent

You are helping with volunteer work on selected open source projects.

## Selected Projects

{project_list}

## Mission

Choose one project from the selected list and complete one useful contribution.

1. Clone the repository locally:
   `git clone <project-url>`
2. Enter the repository and pull the latest default branch.
3. Review open issues and find one issue that appears unassigned, active, and not already being handled in an existing pull request.
4. Analyze the codebase enough to understand the issue and the expected project conventions.
5. Create a focused branch for the fix.
6. Implement the fix with the smallest maintainable change.
7. Run the relevant tests, linters, or validation commands available in the repository.
8. Commit the change with a clear message.
9. Push the branch to your fork or configured remote.
10. Open a merge request or pull request against the upstream project.
11. Report the completed work back to OpenSauce by calling:

```http
POST /achieve
Authorization: Bearer {achievement_token}
Content-Type: application/json

{{
  "name": "Open source contribution",
  "description": "Fixed <issue-url> in <project-url> and opened <merge-request-url>"
}}
```

## Constraints

- Work on exactly one issue at a time.
- Prefer issues with no assignee and no linked active pull request.
- Do not take over work that another contributor is already handling.
- Keep the change small enough for maintainers to review comfortably.
- If a selected project is unavailable, try the next selected project.

## Project URLs

{project_urls}
"""


@achievements_bp.route("/skill", methods=["GET", "POST"])
def get_skill_prompt():
    if request.method == "GET":
        data = {
            "project_ids": request.args.getlist("project_id")
            or request.args.getlist("project_ids"),
            "user_id": request.args.get("user_id"),
        }
    else:
        data = request.get_json(silent=True) or {}

    missing = require_fields(data, ["user_id"])
    if missing:
        return error(missing)

    project_ids = _parse_project_ids(data)
    if project_ids is None:
        return error("project_ids must be a list of project IDs")

    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, name, username FROM users WHERE id = ?",
            (data["user_id"],),
        ).fetchone()
        if user is None:
            return error("User not found", 404)

        if project_ids:
            placeholders = ",".join("?" for _ in project_ids)
            projects = connection.execute(
                f"""
                SELECT id, url, description
                FROM projects
                WHERE id IN ({placeholders})
                ORDER BY id
                """,
                project_ids,
            ).fetchall()
        else:
            projects = connection.execute(
                """
                SELECT id, url, description
                FROM projects
                ORDER BY RANDOM()
                LIMIT 3
                """
            ).fetchall()

    if project_ids and len(projects) != len(set(project_ids)):
        found_ids = {project["id"] for project in projects}
        missing_ids = [
            project_id for project_id in project_ids if project_id not in found_ids
        ]
        return error(f"Project not found: {', '.join(map(str, missing_ids))}", 404)
    if not projects:
        return error("No projects available to generate a skill prompt", 404)

    selected_project_ids = [project["id"] for project in projects]
    token = create_temporary_achievement_token(data["user_id"], selected_project_ids)
    project_data = [row_to_dict(project) for project in projects]
    return jsonify(
        {
            "prompt_filename": "SKILL.md",
            "prompt": _build_skill_prompt(project_data, token),
            "temporary_auth": {
                "oauth_token": token,
                "token_type": "Bearer",
                "scope": "achievement",
                "expires_in": 3600,
            },
            "projects": project_data,
            "user": row_to_dict(user),
        }
    )


@achievements_bp.post("/achieve")
@require_achievement_auth
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
