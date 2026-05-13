import base64
import json

from flask import Blueprint, Response, g, jsonify, request

from ..auth import create_temporary_achievement_token, require_auth, require_achievement_auth
from ..cache import cache_delete_prefix, cache_get, cache_set
from ..config import PUBLIC_BASE_URL
from ..db import get_connection, row_to_dict, transaction
from ..github import (
    fetch_github_repository,
    fetch_pull_request_state,
    fetch_random_open_issue,
    github_repo_url,
    normalize_github_repo,
    parse_github_pull_request_url,
    search_github_repositories,
)
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

STATUSES = {"started", "submitted", "merged", "closed"}


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


def _repo_from_request(data):
    explicit = data.get("github_repo") or data.get("repo")
    repo = normalize_github_repo(explicit)
    if repo:
        return repo

    for key in ("github_repo_url", "project_url", "issue_url", "github_pr_url", "url"):
        repo = normalize_github_repo(data.get(key))
        if repo:
            return repo
    return None


def _pr_data_from_request(data):
    pr_url = data.get("github_pr_url") or data.get("pull_request_url")
    if not pr_url and data.get("url") and "/pull/" in str(data.get("url")):
        pr_url = data.get("url")

    parsed = parse_github_pull_request_url(pr_url)
    if not parsed:
        return {"github_pr_url": pr_url, "github_pr_number": None}
    return parsed


def _status_for_insert(data, pr_data):
    requested = data.get("status")
    if requested:
        if requested not in STATUSES:
            return None, error("status must be one of: started, submitted, merged, closed")
        return requested, None
    if pr_data.get("github_pr_number"):
        return "submitted", None
    return "started", None


def _timestamps_for_status(status):
    return {
        "submitted_at": "now()" if status in {"submitted", "merged", "closed"} else "NULL",
        "merged_at": "now()" if status == "merged" else "NULL",
        "closed_at": "now()" if status == "closed" else "NULL",
    }


@achievements_bp.get("/github/search")
def search_github():
    limit, limit_error = _parse_int_query("limit", default=20, minimum=1, maximum=50)
    if limit_error:
        return limit_error
    page, page_error = _parse_int_query("page", default=1, minimum=1, maximum=34)
    if page_error:
        return page_error
    return jsonify(search_github_repositories(request.args.get("q"), limit, page))


@achievements_bp.get("/github/repos/<path:github_repo>")
def get_github_repo(github_repo):
    repo = fetch_github_repository(github_repo)
    if repo is None:
        return error("GitHub repository not found", 404)
    return jsonify({"repository": repo})


@achievements_bp.get("/achievements")
@require_auth
def list_achievements():
    cache_key = (
        "achievements",
        str(g.current_user["id"]),
        request.query_string.decode("utf-8", errors="ignore"),
    )
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    limit, limit_error = _parse_int_query("limit", default=20, minimum=1, maximum=100)
    if limit_error:
        return limit_error

    offset, offset_error = _parse_int_query("offset", default=0, minimum=0)
    if offset_error:
        return offset_error

    issue_number, issue_error = _parse_int_query("issue_number", minimum=1)
    if issue_error:
        return issue_error

    github_repo = normalize_github_repo(request.args.get("github_repo") or request.args.get("repo"))
    status = request.args.get("status")
    if status and status not in STATUSES:
        return error("status must be one of: started, submitted, merged, closed")

    sort = request.args.get("sort", "recent")
    if sort not in ACHIEVEMENT_SORTS:
        return error(f"sort must be one of: {', '.join(ACHIEVEMENT_SORTS)}")

    filters = ["a.user_id = ?"]
    params = [g.current_user["id"]]

    if github_repo:
        filters.append("a.github_repo = ?")
        params.append(github_repo)
    if issue_number is not None:
        filters.append("a.issue_number = ?")
        params.append(issue_number)
    if status:
        filters.append("a.status = ?")
        params.append(status)

    query = request.args.get("q")
    if query:
        filters.append(
            """
            (
                a.name ILIKE ?
                OR a.description ILIKE ?
                OR a.url ILIKE ?
                OR a.github_repo ILIKE ?
                OR a.github_pr_url ILIKE ?
                OR a.issue_title ILIKE ?
                OR a.issue_url ILIKE ?
            )
            """
        )
        like_query = f"%{query}%"
        params.extend([like_query] * 7)

    where_clause = " AND ".join(filters)
    order_clause = ACHIEVEMENT_SORTS[sort]

    with get_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT
                a.id,
                a.user_id,
                a.github_repo,
                ('https://github.com/' || a.github_repo) AS github_repo_url,
                a.name,
                a.description,
                a.url,
                a.github_pr_url,
                a.github_pr_number,
                a.issue_url,
                a.issue_title,
                a.issue_number,
                a.status,
                a.started_at,
                a.submitted_at,
                a.merged_at,
                a.closed_at,
                a.created_at
            FROM achievements a
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
            WHERE {where_clause}
            """,
            params,
        ).fetchone()["total"]

    payload = {
        "achievements": [row_to_dict(row) for row in rows],
        "pagination": {
            "limit": limit,
            "offset": offset,
            "total": total,
            "has_more": offset + len(rows) < total,
        },
        "filters": {
            "github_repo": github_repo,
            "issue_number": issue_number,
            "status": status,
            "q": query,
            "sort": sort,
        },
    }
    cache_set(cache_key, payload)
    return jsonify(payload)


@achievements_bp.get("/skills")
@require_auth
def list_skills():
    response = list_achievements()
    if isinstance(response, tuple):
        return response

    payload = response.get_json()
    return jsonify({"skills": payload["achievements"], "pagination": payload["pagination"]})


def _parse_github_repos(data):
    raw_repos = data.get("github_repos", data.get("github_repo", []))
    if raw_repos in (None, ""):
        return []
    if isinstance(raw_repos, str):
        raw_repos = [raw_repos]

    repos = []
    for raw_repo in raw_repos:
        repo = normalize_github_repo(raw_repo)
        if not repo:
            return None
        repos.append(repo)
    return list(dict.fromkeys(repos))


def _build_skill_prompt(github_repos, achievement_token, api_base_url, assigned_issue):
    repo_list = "\n".join(f"- {repo}: {github_repo_url(repo)}" for repo in github_repos)
    issue_section = ""
    if assigned_issue:
        issue_section = f"""## Assigned Issue

- Repository: {assigned_issue['github_repo']}
- Issue: #{assigned_issue['number']} {assigned_issue['title']}
- URL: {assigned_issue['url']}

Work on this assigned issue. The achievement token already contains this issue context, so the final `/achieve` call does not need `github_repo` or `issue_url`.
"""

    return f"""# Open Source Volunteer Agent

You are helping with volunteer work on selected open source repositories.

## Selected Repositories

{repo_list}

{issue_section}

## Mission

Complete one useful contribution for the assigned repository.

1. Clone the repository locally.
2. Review the assigned issue if one was provided.
3. Create a focused branch for the fix.
4. Implement the fix with the smallest maintainable change.
5. Run the relevant tests, linters, or validation commands available in the repository.
6. Commit the change with a clear message.
7. Push the branch to your fork or configured remote.
8. Open a pull request against the upstream project.
9. Report the completed work back to OpenSauce by calling:

```http
POST {api_base_url}/achieve
Authorization: Bearer {achievement_token}
Content-Type: application/json

{{
  "name": "Open source contribution",
  "github_pr_url": "<pull-request-url>",
  "description": "Fixed the assigned issue and opened <pull-request-url>"
}}
```

## Constraints

- Work on exactly one issue at a time.
- Prefer issues with no assignee and no linked active pull request.
- Do not take over work that another contributor is already handling.
- Keep the change small enough for maintainers to review comfortably.
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
            a.github_repo,
            ('https://github.com/' || a.github_repo) AS github_repo_url,
            COUNT(a.id) AS contributions,
            COUNT(*) FILTER (WHERE a.status = 'started') AS started_count,
            COUNT(*) FILTER (WHERE a.status = 'submitted') AS submitted_count,
            COUNT(*) FILTER (WHERE a.status = 'merged') AS merged_count,
            COUNT(*) FILTER (WHERE a.status = 'closed') AS closed_count
        FROM achievements a
        WHERE a.created_at >= now() - (?::interval)
        GROUP BY a.github_repo
        ORDER BY contributions DESC, a.github_repo ASC
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
            COUNT(a.id) AS contributions,
            COUNT(*) FILTER (WHERE a.status = 'started') AS started_count,
            COUNT(*) FILTER (WHERE a.status = 'submitted') AS submitted_count,
            COUNT(*) FILTER (WHERE a.status = 'merged') AS merged_count,
            COUNT(*) FILTER (WHERE a.status = 'closed') AS closed_count
        FROM achievements a
        JOIN profiles u ON u.id = a.user_id
        WHERE a.created_at >= now() - (?::interval)
        GROUP BY u.id, u.name, u.username
        ORDER BY merged_count DESC, submitted_count DESC, started_count DESC, u.id ASC
        LIMIT ?
        """,
        (since_modifier, top_n),
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def _resolve_github_repo_from_token(data):
    assigned_issue = g.token_payload.get("assigned_issue")
    if assigned_issue:
        return assigned_issue["github_repo"], None

    token_repos = g.token_payload.get("github_repos", [])
    repo = _repo_from_request(data)
    if repo is None and len(token_repos) == 1:
        repo = token_repos[0]
    if repo is None:
        return None, error("github_repo is required for this achievement token")
    if repo not in token_repos:
        return None, error("Temporary token cannot record work for this repository", 403)
    return repo, None


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
        repos = decoded.get("r") or []
        if not isinstance(repos, list):
            repos = [repos]
        return {"github_repos": repos, "user_id": decoded.get("u")}
    return {
        "github_repos": request.args.getlist("github_repo")
        or request.args.getlist("github_repos"),
        "user_id": request.args.get("user_id"),
    }


def _build_magic_token(user_id, github_repos):
    payload = json.dumps({"u": user_id, "r": github_repos}, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("utf-8").rstrip("=")


def _build_skill_response_payload(data):
    missing = require_fields(data, ["user_id"])
    if missing:
        return None, error(missing)

    github_repos = _parse_github_repos(data)
    if github_repos is None:
        return None, error("github_repos must contain GitHub repositories like owner/repo")
    if not github_repos:
        return None, error("github_repo is required")

    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, name, username FROM profiles WHERE id = ?",
            (data["user_id"],),
        ).fetchone()
        if user is None:
            return None, error("User not found", 404)

    assigned_issue = fetch_random_open_issue(github_repos)
    if not assigned_issue:
        return None, error("No open unassigned GitHub issue available for selected repositories")

    token = create_temporary_achievement_token(
        data["user_id"], github_repos, assigned_issue=assigned_issue
    )
    base_url = PUBLIC_BASE_URL or request.url_root.rstrip("/")
    prompt = _build_skill_prompt(github_repos, token, base_url, assigned_issue)
    magic_token = _build_magic_token(data["user_id"], github_repos)
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
        "github_repos": github_repos,
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

    cache_key = ("achievement_dashboard", top_n)
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    with get_connection() as connection:
        dashboard = {
            window: {
                "top_repositories": _top_repositories(connection, modifier, top_n),
                "top_users": _top_users(connection, modifier, top_n),
            }
            for window, modifier in WINDOWS.items()
        }

    payload = {"top_n": top_n, "windows": dashboard}
    cache_set(cache_key, payload)
    return jsonify(payload)


@achievements_bp.post("/achieve")
@require_achievement_auth
def add_achievement():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["name"])
    if missing:
        return error(missing)

    pr_data = _pr_data_from_request(data)
    if g.auth_scope == "achievement":
        github_repo, repo_error = _resolve_github_repo_from_token(data)
        if repo_error:
            return repo_error
        issue_data, issue_error = _resolve_issue_from_token(data)
        if issue_error:
            return issue_error
    else:
        github_repo = _repo_from_request(data) or pr_data.get("github_repo")
        if not github_repo:
            return error("github_repo is required")
        issue_data, issue_error = _issue_data_from_request(data)
        if issue_error:
            return issue_error

    if pr_data.get("github_repo") and pr_data["github_repo"] != github_repo:
        return error("Pull request URL does not match github_repo")

    status, status_error = _status_for_insert(data, pr_data)
    if status_error:
        return status_error
    timestamps = _timestamps_for_status(status)

    with transaction() as connection:
        cursor = connection.execute(
            f"""
            INSERT INTO achievements (
                user_id,
                github_repo,
                name,
                description,
                url,
                github_pr_url,
                github_pr_number,
                issue_url,
                issue_title,
                issue_number,
                status,
                submitted_at,
                merged_at,
                closed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, {timestamps['submitted_at']}, {timestamps['merged_at']}, {timestamps['closed_at']})
            """,
            (
                g.current_user["id"],
                github_repo,
                data["name"],
                data.get("description"),
                data.get("url") or pr_data.get("github_pr_url"),
                pr_data.get("github_pr_url"),
                pr_data.get("github_pr_number"),
                issue_data["issue_url"],
                issue_data["issue_title"],
                issue_data["issue_number"],
                status,
            ),
        )
        connection.execute(
            """
            INSERT INTO activities (user_id, github_repo, type, url)
            VALUES (?, ?, ?, ?)
            """,
            (
                g.current_user["id"],
                github_repo,
                status,
                pr_data.get("github_pr_url") or data.get("url"),
            ),
        )
        achievement = connection.execute(
            """
            SELECT
                id,
                user_id,
                github_repo,
                ('https://github.com/' || github_repo) AS github_repo_url,
                name,
                description,
                url,
                github_pr_url,
                github_pr_number,
                issue_url,
                issue_title,
                issue_number,
                status,
                started_at,
                submitted_at,
                merged_at,
                closed_at,
                created_at
            FROM achievements
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()

    cache_delete_prefix(("achievements", str(g.current_user["id"])))
    cache_delete_prefix(("achievement_dashboard",))
    return jsonify({"achievement": row_to_dict(achievement)}), 201


@achievements_bp.post("/achievements/<int:achievement_id>/sync")
@require_auth
def sync_achievement(achievement_id):
    with transaction() as connection:
        achievement = connection.execute(
            """
            SELECT id, user_id, github_repo, github_pr_number, status
            FROM achievements
            WHERE id = ? AND user_id = ?
            """,
            (achievement_id, g.current_user["id"]),
        ).fetchone()
        if achievement is None:
            return error("Achievement not found", 404)
        if not achievement["github_pr_number"]:
            return error("Achievement has no pull request to sync")

        new_status = fetch_pull_request_state(
            achievement["github_repo"], achievement["github_pr_number"]
        )
        if new_status is None:
            return error("Could not fetch pull request state from GitHub", 502)

        if new_status != achievement["status"]:
            timestamps = _timestamps_for_status(new_status)
            connection.execute(
                f"""
                UPDATE achievements
                SET status = ?,
                    submitted_at = COALESCE(submitted_at, {timestamps['submitted_at']}),
                    merged_at = COALESCE(merged_at, {timestamps['merged_at']}),
                    closed_at = COALESCE(closed_at, {timestamps['closed_at']})
                WHERE id = ?
                """,
                (new_status, achievement_id),
            )
            connection.execute(
                """
                INSERT INTO activities (user_id, github_repo, type)
                VALUES (?, ?, ?)
                """,
                (g.current_user["id"], achievement["github_repo"], new_status),
            )
            cache_delete_prefix(("achievements", str(g.current_user["id"])))
            cache_delete_prefix(("achievement_dashboard",))

        updated = connection.execute(
            """
            SELECT
                id,
                user_id,
                github_repo,
                ('https://github.com/' || github_repo) AS github_repo_url,
                name,
                description,
                url,
                github_pr_url,
                github_pr_number,
                issue_url,
                issue_title,
                issue_number,
                status,
                started_at,
                submitted_at,
                merged_at,
                closed_at,
                created_at
            FROM achievements
            WHERE id = ?
            """,
            (achievement_id,),
        ).fetchone()

    return jsonify({"achievement": row_to_dict(updated)})
