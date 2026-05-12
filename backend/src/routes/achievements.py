import base64
import json
from urllib.parse import urlencode

from flask import Blueprint, Response, g, jsonify, request

from ..auth import create_temporary_achievement_token, require_auth, require_achievement_auth
from ..config import PUBLIC_BASE_URL
from ..db import get_connection, row_to_dict, transaction
from ..github import fetch_random_open_issue
from ..responses import error, require_fields


achievements_bp = Blueprint("achievements", __name__)


WINDOWS = {
    "daily": "1 day",
    "weekly": "7 days",
    "monthly": "30 days",
}

ACHIEVEMENT_SORTS = {
    "recent": "a.created_at DESC, a.id DESC",
    "oldest": "a.created_at ASC, a.id ASC",
    "name": "lower(a.name) ASC, a.id DESC",
}


def _parse_int_query(name, default=None, minimum=None, maximum=None):
    raw_value = request.args.get(name)
    if raw_value in (None, ""):
        return default, None

    try:
        value = int(raw_value)
    except ValueError:
        return None, error(f"{name} must be an integer")

    if minimum is not None and value < minimum:
        return None, error(f"{name} must be at least {minimum}")
    if maximum is not None and value > maximum:
        return None, error(f"{name} must be at most {maximum}")

    return value, None


@achievements_bp.get("/achievements")
@require_auth
def list_achievements():
    limit, limit_error = _parse_int_query("limit", default=20, minimum=1, maximum=100)
    if limit_error:
        return limit_error

    offset, offset_error = _parse_int_query("offset", default=0, minimum=0)
    if offset_error:
        return offset_error

    project_id, project_error = _parse_int_query("project_id", minimum=1)
    if project_error:
        return project_error

    issue_number, issue_error = _parse_int_query("issue_number", minimum=1)
    if issue_error:
        return issue_error

    sort = request.args.get("sort", "recent")
    if sort not in ACHIEVEMENT_SORTS:
        return error(f"sort must be one of: {', '.join(ACHIEVEMENT_SORTS)}")

    filters = ["a.user_id = ?"]
    params = [g.current_user["id"]]

    if project_id is not None:
        filters.append("a.project_id = ?")
        params.append(project_id)
    if issue_number is not None:
        filters.append("a.issue_number = ?")
        params.append(issue_number)

    query = request.args.get("q")
    if query:
        filters.append(
            """
            (
                a.name ILIKE ?
                OR a.description ILIKE ?
                OR a.url ILIKE ?
                OR a.issue_title ILIKE ?
                OR a.issue_url ILIKE ?
                OR p.url ILIKE ?
            )
            """
        )
        like_query = f"%{query}%"
        params.extend([like_query] * 6)

    where_clause = " AND ".join(filters)
    order_clause = ACHIEVEMENT_SORTS[sort]

    with get_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT
                a.id,
                a.user_id,
                a.project_id,
                p.url AS project_url,
                p.description AS project_description,
                a.name,
                a.description,
                a.url,
                a.issue_url,
                a.issue_title,
                a.issue_number,
                a.created_at
            FROM achievements a
            LEFT JOIN projects p ON p.id = a.project_id
            WHERE {where_clause}
            ORDER BY {order_clause}
            LIMIT ? OFFSET ?
            """,
            (*params, limit, offset),
        ).fetchall()
        total = connection.execute(
            f"""
            SELECT COUNT(*) AS total
            FROM achievements a
            LEFT JOIN projects p ON p.id = a.project_id
            WHERE {where_clause}
            """,
            params,
        ).fetchone()["total"]

    return jsonify(
        {
            "achievements": [row_to_dict(row) for row in rows],
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": total,
                "has_more": offset + len(rows) < total,
            },
            "filters": {
                "project_id": project_id,
                "issue_number": issue_number,
                "q": query,
                "sort": sort,
            },
        }
    )


@achievements_bp.get("/skills")
@require_auth
def list_skills():
    response = list_achievements()
    if isinstance(response, tuple):
        return response

    payload = response.get_json()
    return jsonify({"skills": payload["achievements"], "pagination": payload["pagination"]})


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


def _build_skill_prompt(projects, achievement_token, api_base_url):
    project_list = "\n".join(
        f"- Project {project['id']}: {project['url']} - {project['description']}"
        for project in projects
    )
    project_urls = "\n".join(f"- {project['url']}" for project in projects)
    assigned_issue = next(
        (project.get("assigned_issue") for project in projects if project.get("assigned_issue")),
        None,
    )
    issue_section = f"""## Assigned Issue

- Project: {assigned_issue['project_url']}
- Issue: #{assigned_issue['number']} {assigned_issue['title']}
- URL: {assigned_issue['url']}

Work on this assigned issue. The achievement token already contains this issue context, so the final `/achieve` call does not need `project_id`, `project_url`, or `issue_url`.
"""

    return f"""# Open Source Volunteer Agent

You are helping with volunteer work on selected open source projects.

## Selected Projects

{project_list}

{issue_section}

## Mission

Complete one useful contribution for the assigned issue.

1. Clone the repository locally:
   `git clone <project-url>`
2. Enter the repository and pull the latest default branch.
3. Review the assigned issue and confirm it is still open, unassigned, and not already being handled in an existing pull request.
4. Analyze the codebase enough to understand the issue and the expected project conventions.
5. Create a focused branch for the fix.
6. Implement the fix with the smallest maintainable change.
7. Run the relevant tests, linters, or validation commands available in the repository.
8. Commit the change with a clear message.
9. Push the branch to your fork or configured remote.
10. Open a merge request or pull request against the upstream project.
11. Report the completed work back to OpenSauce by calling:

```http
POST {api_base_url}/achieve
Authorization: Bearer {achievement_token}
Content-Type: application/json

{{
  "name": "Open source contribution",
  "url": "<merge-request-url>",
  "description": "Fixed the assigned issue and opened <merge-request-url>"
}}
```

## Constraints

- Work on exactly one issue at a time.
- Prefer issues with no assignee and no linked active pull request.
- Do not take over work that another contributor is already handling.
- Keep the change small enough for maintainers to review comfortably.
- If a selected project is unavailable, try the next selected project.
- The achievement token already contains the assigned issue context.

## Project URLs

{project_urls}
"""


def _parse_top_n():
    try:
        top_n = int(request.args.get("top_n", "10"))
    except ValueError:
        return None

    if top_n < 1 or top_n > 100:
        return None
    return top_n


def _top_repositories(connection, since_modifier, top_n):
    rows = connection.execute(
        """
        SELECT
            p.id AS project_id,
            p.url AS project_url,
            p.description AS project_description,
            COUNT(a.id) AS contributions
        FROM achievements a
        JOIN projects p ON p.id = a.project_id
        WHERE a.created_at >= now() - (?::interval)
        GROUP BY p.id, p.url, p.description
        ORDER BY contributions DESC, p.id ASC
        LIMIT ?
        """,
        (since_modifier, top_n),
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def _top_users(connection, since_modifier, top_n):
    rows = connection.execute(
        """
        SELECT
            u.id AS user_id,
            u.name,
            u.username,
            COUNT(a.id) AS contributions
        FROM achievements a
        JOIN profiles u ON u.id = a.user_id
        WHERE a.created_at >= now() - (?::interval)
        GROUP BY u.id, u.name, u.username
        ORDER BY contributions DESC, u.id ASC
        LIMIT ?
        """,
        (since_modifier, top_n),
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def _resolve_project_id_from_token(data):
    assigned_issue = g.token_payload.get("assigned_issue")
    if assigned_issue:
        return assigned_issue["project_id"], None

    token_projects = g.token_payload.get("projects", [])
    token_project_ids = g.token_payload.get("project_ids", [])

    if not token_projects and token_project_ids:
        token_projects = [{"id": project_id} for project_id in token_project_ids]

    project_id = data.get("project_id")
    if project_id is not None:
        try:
            project_id = int(project_id)
        except (TypeError, ValueError):
            return None, error("project_id must be an integer")
    elif data.get("project_url"):
        matching_projects = [
            project
            for project in token_projects
            if project.get("url") == data.get("project_url")
        ]
        if not matching_projects:
            return None, error("Temporary token cannot record work for this project", 403)
        project_id = matching_projects[0]["id"]
    elif len(token_projects) == 1:
        project_id = token_projects[0]["id"]
    else:
        return None, error(
            "project_id or project_url is required for multi-project temporary tokens"
        )

    if project_id not in [project["id"] for project in token_projects]:
        return None, error("Temporary token cannot record work for this project", 403)

    return project_id, None


def _resolve_issue_from_token(data):
    assigned_issue = g.token_payload.get("assigned_issue")
    if not assigned_issue:
        return _issue_data_from_request(data)

    if data.get("issue_url") and data["issue_url"] != assigned_issue["url"]:
        return None, error("Temporary token cannot record work for this issue", 403)

    return {
        "issue_url": assigned_issue["url"],
        "issue_title": assigned_issue["title"],
        "issue_number": assigned_issue["number"],
    }, None


def _issue_data_from_request(data):
    issue_number = data.get("issue_number")
    if issue_number is not None:
        try:
            issue_number = int(issue_number)
        except (TypeError, ValueError):
            return None, error("issue_number must be an integer")

    return {
        "issue_url": data.get("issue_url"),
        "issue_title": data.get("issue_title"),
        "issue_number": issue_number,
    }, None


def _skill_request_data_from_args():
    token = request.args.get("t")
    if token:
        try:
            decoded = json.loads(
                base64.urlsafe_b64decode(token + "=" * (-len(token) % 4)).decode("utf-8")
            )
        except (ValueError, TypeError):
            decoded = {}
        project_ids = decoded.get("p") or []
        if not isinstance(project_ids, list):
            project_ids = [project_ids]
        return {
            "project_ids": [str(pid) for pid in project_ids],
            "user_id": decoded.get("u"),
        }
    return {
        "project_ids": request.args.getlist("project_id")
        or request.args.getlist("project_ids"),
        "user_id": request.args.get("user_id"),
    }


def _build_magic_token(user_id, project_ids):
    payload = json.dumps(
        {"u": user_id, "p": project_ids}, separators=(",", ":")
    ).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("utf-8").rstrip("=")


def _pick_best_issue(projects, _user_skills=None):
    """Pick an issue from the selected projects.

    Smart matching now lives in ``POST /projects/recommend`` (called from
    the marketplace UI), so this stays simple and fast: just delegate to
    ``fetch_random_open_issue``.
    """
    return fetch_random_open_issue(projects)


def _build_skill_response_payload(data):
    missing = require_fields(data, ["user_id"])
    if missing:
        return None, error(missing)

    project_ids = _parse_project_ids(data)
    if project_ids is None:
        return None, error("project_ids must be a list of project IDs")

    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, name, username FROM profiles WHERE id = ?",
            (data["user_id"],),
        ).fetchone()
        if user is None:
            return None, error("User not found", 404)

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
                ORDER BY random()
                LIMIT 3
                """
            ).fetchall()

    if project_ids and len(projects) != len(set(project_ids)):
        found_ids = {project["id"] for project in projects}
        missing_ids = [
            project_id for project_id in project_ids if project_id not in found_ids
        ]
        return None, error(f"Project not found: {', '.join(map(str, missing_ids))}", 404)
    if not projects:
        return None, error("No projects available to generate a skill prompt", 404)

    project_data = [row_to_dict(project) for project in projects]
    assigned_issue = _pick_best_issue(project_data, None)
    if not assigned_issue:
        return None, error(
            "No open unassigned GitHub issue available for selected projects"
        )

    if assigned_issue:
        for project in project_data:
            if project["id"] == assigned_issue["project_id"]:
                project["assigned_issue"] = assigned_issue

    token = create_temporary_achievement_token(
        data["user_id"], project_data, assigned_issue=assigned_issue
    )
    base_url = PUBLIC_BASE_URL or request.url_root.rstrip("/")
    prompt = _build_skill_prompt(project_data, token, base_url)
    magic_token = _build_magic_token(data["user_id"], project_ids)
    magic_url = f"{base_url}/skill.md?t={magic_token}"

    return {
        "prompt_filename": "SKILL.md",
        "prompt": prompt,
        "magic_url": magic_url,
        "temporary_auth": {
            "oauth_token": token,
            "token_type": "Bearer",
            "scope": "achievement",
            "expires_in": 3600,
        },
        "projects": project_data,
        "assigned_issue": assigned_issue,
        "user": row_to_dict(user),
    }, None


@achievements_bp.route("/skill", methods=["GET", "POST"])
def get_skill_prompt():
    if request.method == "GET":
        data = _skill_request_data_from_args()
    else:
        data = request.get_json(silent=True) or {}

    payload, payload_error = _build_skill_response_payload(data)
    if payload_error:
        return payload_error
    return jsonify(payload)


@achievements_bp.get("/skill.md")
def get_skill_markdown():
    payload, payload_error = _build_skill_response_payload(_skill_request_data_from_args())
    if payload_error:
        return payload_error
    return Response(
        payload["prompt"],
        mimetype="text/markdown",
        headers={"Content-Disposition": 'inline; filename="SKILL.md"'},
    )


@achievements_bp.get("/achievement/dashboard")
@achievements_bp.get("/achievements/dashboard")
def get_achievement_dashboard():
    top_n = _parse_top_n()
    if top_n is None:
        return error("top_n must be an integer between 1 and 100")

    with get_connection() as connection:
        dashboard = {
            window: {
                "top_repositories": _top_repositories(connection, modifier, top_n),
                "top_users": _top_users(connection, modifier, top_n),
            }
            for window, modifier in WINDOWS.items()
        }

    return jsonify({"top_n": top_n, "windows": dashboard})


@achievements_bp.post("/achieve")
@require_achievement_auth
def add_achievement():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["name"])
    if missing:
        return error(missing)

    if g.auth_scope == "achievement":
        project_id, project_error = _resolve_project_id_from_token(data)
        if project_error:
            return project_error
        issue_data, issue_error = _resolve_issue_from_token(data)
        if issue_error:
            return issue_error
    else:
        project_id = data.get("project_id")
        if project_id is not None:
            try:
                project_id = int(project_id)
            except (TypeError, ValueError):
                return error("project_id must be an integer")
        issue_data, issue_error = _issue_data_from_request(data)
        if issue_error:
            return issue_error

    with transaction() as connection:
        if project_id is not None:
            project = connection.execute(
                "SELECT id FROM projects WHERE id = ?",
                (project_id,),
            ).fetchone()
            if project is None:
                return error("Project not found", 404)

        cursor = connection.execute(
            """
            INSERT INTO achievements (
                user_id,
                project_id,
                name,
                description,
                url,
                issue_url,
                issue_title,
                issue_number
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                g.current_user["id"],
                project_id,
                data["name"],
                data.get("description"),
                data.get("url"),
                issue_data["issue_url"],
                issue_data["issue_title"],
                issue_data["issue_number"],
            ),
        )
        achievement = connection.execute(
            """
            SELECT
                id,
                user_id,
                project_id,
                name,
                description,
                url,
                issue_url,
                issue_title,
                issue_number,
                created_at
            FROM achievements
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()

    return jsonify({"achievement": row_to_dict(achievement)}), 201
