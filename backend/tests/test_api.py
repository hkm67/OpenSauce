import importlib
import sys
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from urllib.parse import unquote, urlparse

import jwt
import psycopg
import pytest


USER_ID = "11111111-1111-1111-1111-111111111111"
UNKNOWN_USER_ID = "22222222-2222-2222-2222-222222222222"


class FakeCursor:
    def __init__(self, rows=None, rowcount=0, lastrowid=None):
        self.rows = rows or []
        self.rowcount = rowcount
        self.lastrowid = lastrowid

    def fetchone(self):
        return self.rows[0] if self.rows else None

    def fetchall(self):
        return self.rows


class FakeDb:
    def __init__(self):
        self.profiles = {
            USER_ID: {
                "id": USER_ID,
                "name": "Ada Lovelace",
                "username": "ada",
                "preferences": {"categories": [], "notes": ""},
            }
        }
        self.auth_users = {}
        self.projects = [
            {"id": 1, "url": "https://github.com/example/project", "description": "Example", "created_at": "2026-01-01T00:00:00Z"},
            {"id": 2, "url": "https://github.com/example/other", "description": "Other", "created_at": "2026-01-02T00:00:00Z"},
            {"id": 3, "url": "https://github.com/example/third", "description": "Third", "created_at": "2026-01-03T00:00:00Z"},
        ]
        self.achievements = []
        self.activities = []

    def execute(self, query, params=None):
        params = params or ()
        sql = " ".join(query.lower().split())

        if "from profiles where id" in sql:
            row = self.profiles.get(str(params[0]))
            if row and "select id, name, username" in sql:
                row = {k: row[k] for k in ("id", "name", "username")}
            return FakeCursor([row] if row else [])

        if "from auth.users where email" in sql:
            row = next((u for u in self.auth_users.values() if u["email"] == params[0]), None)
            return FakeCursor([row] if row else [])

        if "from profiles where username" in sql:
            row = next((p for p in self.profiles.values() if p["username"] == params[0]), None)
            return FakeCursor([{"id": row["id"]}] if row else [])

        if sql.startswith("insert into profiles"):
            if any(p["username"] == params[2] for p in self.profiles.values()):
                raise psycopg.errors.UniqueViolation("duplicate username")
            profile = {
                "id": params[0],
                "name": params[1],
                "username": params[2],
                "preferences": {"categories": [], "notes": ""},
            }
            self.profiles[profile["id"]] = profile
            return FakeCursor([{k: profile[k] for k in ("id", "name", "username")}])

        if sql.startswith("insert into auth.users"):
            if "on conflict" in sql and str(params[0]) in self.auth_users:
                return FakeCursor(rowcount=0)
            if len(params) > 1 and any(u["email"] == params[1] for u in self.auth_users.values()):
                raise psycopg.errors.UniqueViolation("duplicate email")
            user = {
                "id": str(params[0]),
                "email": params[1] if len(params) > 1 else None,
                "password_hash": params[2] if len(params) > 2 else None,
            }
            self.auth_users[user["id"]] = user
            return FakeCursor(rowcount=1)

        if sql.startswith("update profiles set preferences"):
            profile = self.profiles.get(str(params[1]))
            if profile:
                profile["preferences"] = json_loads(params[0])
            return FakeCursor(rowcount=1 if profile else 0)

        if "select preferences from profiles" in sql:
            profile = self.profiles.get(str(params[0]))
            return FakeCursor([{"preferences": profile["preferences"]}] if profile else [])

        if "from projects order by id desc" in sql:
            return FakeCursor(sorted(self.projects, key=lambda p: p["id"], reverse=True))

        if "from projects where id in" in sql:
            ids = {int(value) for value in params}
            return FakeCursor([project for project in self.projects if project["id"] in ids])

        if "from projects order by random" in sql:
            return FakeCursor(self.projects[:3])

        if "select id from projects where id" in sql:
            project = next((p for p in self.projects if p["id"] == int(params[0])), None)
            return FakeCursor([{"id": project["id"]}] if project else [])

        if sql.startswith("insert into projects"):
            if any(p["url"] == params[0] for p in self.projects):
                raise psycopg.errors.UniqueViolation("duplicate project")
            project = {
                "id": max(p["id"] for p in self.projects) + 1,
                "url": params[0],
                "description": params[1],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self.projects.append(project)
            return FakeCursor(lastrowid=project["id"])

        if sql.startswith("delete from projects where id"):
            before = len(self.projects)
            self.projects = [p for p in self.projects if p["id"] != int(params[0])]
            return FakeCursor(rowcount=before - len(self.projects))

        if sql.startswith("delete from projects where url"):
            before = len(self.projects)
            self.projects = [p for p in self.projects if p["url"] != params[0]]
            return FakeCursor(rowcount=before - len(self.projects))

        if sql.startswith("insert into activities"):
            activity = {
                "id": len(self.activities) + 1,
                "user_id": params[0],
                "github_repo": params[1],
                "type": params[2],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "url": params[3] if len(params) > 3 else None,
            }
            self.activities.append(activity)
            return FakeCursor(lastrowid=activity["id"])

        if "from activities where id" in sql:
            row = next((a for a in self.activities if a["id"] == int(params[0])), None)
            return FakeCursor([row] if row else [])

        if sql.startswith("insert into achievements"):
            achievement = {
                "id": len(self.achievements) + 1,
                "user_id": params[0],
                "github_repo": params[1],
                "github_repo_url": f"https://github.com/{params[1]}",
                "name": params[2],
                "description": params[3],
                "url": params[4],
                "github_pr_url": params[5],
                "github_pr_number": params[6],
                "issue_url": params[7],
                "issue_title": params[8],
                "issue_number": params[9],
                "status": params[10],
                "started_at": datetime.now(timezone.utc).isoformat(),
                "submitted_at": datetime.now(timezone.utc).isoformat() if params[10] in {"submitted", "merged", "closed"} else None,
                "merged_at": datetime.now(timezone.utc).isoformat() if params[10] == "merged" else None,
                "closed_at": datetime.now(timezone.utc).isoformat() if params[10] == "closed" else None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self.achievements.append(achievement)
            return FakeCursor(lastrowid=achievement["id"])

        if "from achievements where id" in sql:
            row = next((a for a in self.achievements if a["id"] == int(params[0])), None)
            return FakeCursor([row] if row else [])

        if "select count(*) as total from achievements" in sql:
            return FakeCursor([{"total": len(self._filter_achievements(sql, params))}])

        if "group by a.github_repo" in sql:
            rows = []
            for repo in sorted({a["github_repo"] for a in self.achievements}):
                repo_achievements = [a for a in self.achievements if a["github_repo"] == repo]
                count = len(repo_achievements)
                if count:
                    rows.append({
                        "github_repo": repo,
                        "github_repo_url": f"https://github.com/{repo}",
                        "contributions": count,
                        "started_count": sum(1 for a in repo_achievements if a["status"] == "started"),
                        "submitted_count": sum(1 for a in repo_achievements if a["status"] == "submitted"),
                        "merged_count": sum(1 for a in repo_achievements if a["status"] == "merged"),
                        "closed_count": sum(1 for a in repo_achievements if a["status"] == "closed"),
                    })
            return FakeCursor(sorted(rows, key=lambda r: (-r["contributions"], r["github_repo"]))[: int(params[1])])

        if "from achievements a join profiles u" in sql:
            rows = []
            for profile in self.profiles.values():
                count = sum(1 for a in self.achievements if a["user_id"] == profile["id"])
                if count:
                    rows.append({
                        "user_id": profile["id"],
                        "name": profile["name"],
                        "username": profile["username"],
                        "contributions": count,
                        "started_count": sum(1 for a in self.achievements if a["user_id"] == profile["id"] and a["status"] == "started"),
                        "submitted_count": sum(1 for a in self.achievements if a["user_id"] == profile["id"] and a["status"] == "submitted"),
                        "merged_count": sum(1 for a in self.achievements if a["user_id"] == profile["id"] and a["status"] == "merged"),
                        "closed_count": sum(1 for a in self.achievements if a["user_id"] == profile["id"] and a["status"] == "closed"),
                    })
            return FakeCursor(sorted(rows, key=lambda r: (-r["contributions"], r["user_id"]))[: int(params[1])])

        if "from achievements a where" in sql:
            limit = int(params[-2])
            offset = int(params[-1])
            rows = self._filter_achievements(sql, params[:-2])
            if "order by lower(a.name)" in sql:
                rows = sorted(rows, key=lambda a: (a["name"].lower(), -a["id"]))
            elif "a.created_at asc" in sql:
                rows = sorted(rows, key=lambda a: (a["created_at"], a["id"]))
            else:
                rows = sorted(rows, key=lambda a: (a["created_at"], a["id"]), reverse=True)
            return FakeCursor([self._achievement_row(row) for row in rows[offset:offset + limit]])

        return FakeCursor([])

    def _filter_achievements(self, sql, params):
        rows = [a for a in self.achievements if a["user_id"] == params[0]]
        idx = 1
        if "a.github_repo =" in sql:
            rows = [a for a in rows if a["github_repo"] == params[idx]]
            idx += 1
        if "a.issue_number =" in sql:
            rows = [a for a in rows if a["issue_number"] == int(params[idx])]
            idx += 1
        if " ilike " in sql:
            needle = str(params[idx]).strip("%").lower()
            def haystack(row):
                fields = [row.get("name"), row.get("description"), row.get("url"), row.get("github_repo"), row.get("github_pr_url"), row.get("issue_title"), row.get("issue_url")]
                return " ".join(str(field or "") for field in fields).lower()
            rows = [a for a in rows if needle in haystack(a)]
        return rows

    def _achievement_row(self, row):
        out = dict(row)
        out["github_repo_url"] = f"https://github.com/{row['github_repo']}"
        return out

    def close(self):
        pass

    def commit(self):
        pass

    def rollback(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        pass


def json_loads(value):
    import json

    return json.loads(value)


@pytest.fixture()
def fake_db():
    return FakeDb()


@pytest.fixture()
def client(monkeypatch, fake_db):
    for name in ("DATABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_JWT_SECRET"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("SECRET_KEY", "backend-secret")
    monkeypatch.setenv(
        "DB_URL_TEMPLATE",
        "postgresql://postgres:[YOUR-PASSWORD]@db.example.supabase.co:5432/postgres",
    )
    monkeypatch.setenv("DB_PASSWORD", "secret")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    monkeypatch.setenv("OPENSAUCE_SKIP_DB_INIT", "1")
    monkeypatch.setenv("CLOD_API_KEY", "")

    for module_name in list(sys.modules):
        if module_name == "src" or module_name.startswith("src."):
            sys.modules.pop(module_name)

    app_module = importlib.import_module("src.app")
    importlib.import_module("src.cache").cache_clear()
    importlib.import_module("src.github").clear_github_cache()

    @contextmanager
    def fake_transaction():
        yield fake_db

    monkeypatch.setattr("src.auth.get_connection", lambda: fake_db)
    monkeypatch.setattr("src.routes.users.get_connection", lambda: fake_db)
    monkeypatch.setattr("src.routes.activities.get_connection", lambda: fake_db)
    monkeypatch.setattr("src.routes.achievements.get_connection", lambda: fake_db)
    monkeypatch.setattr("src.routes.users.transaction", fake_transaction)
    monkeypatch.setattr("src.routes.activities.transaction", fake_transaction)
    monkeypatch.setattr("src.routes.achievements.transaction", fake_transaction)
    monkeypatch.setattr(
        "src.routes.users._supabase_request",
        lambda path, payload: {
            "user": {
                "id": USER_ID if payload.get("email") != "new@example.com" else "33333333-3333-3333-3333-333333333333"
            }
        },
    )
    monkeypatch.setattr(
        "src.routes.achievements.fetch_random_open_issue",
        lambda repos: {
            "github_repo": repos[0],
            "number": 42,
            "title": "Fix flaky contribution flow",
            "url": f"https://github.com/{repos[0]}/issues/42",
        },
    )

    app_module.app.config.update(TESTING=True)
    return app_module.app.test_client()


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def make_user_token(user_id=USER_ID, expires_delta=timedelta(hours=1), **extra):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "scope": "user",
        "iat": now,
        "exp": now + expires_delta,
    }
    payload.update(extra)
    return jwt.encode(payload, "backend-secret", algorithm="HS256")


def make_temporary_token(user_id=USER_ID, scope="achievement", **extra):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "scope": scope,
        "github_repos": ["example/project"],
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    payload.update(extra)
    return jwt.encode(payload, "backend-secret", algorithm="HS256")


def test_health_endpoint(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_database_url_can_be_built_from_template_and_password(monkeypatch):
    for module_name in ("src.config",):
        sys.modules.pop(module_name, None)
    for name in ("DATABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_JWT_SECRET"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv(
        "DB_URL_TEMPLATE",
        "postgresql://postgres:[YOUR-PASSWORD]@db.example.supabase.co:5432/postgres",
    )
    monkeypatch.setenv("DB_PASSWORD", "kYez!b$@/x#%")

    config = importlib.import_module("src.config")
    parsed = urlparse(config.DB_DSN)

    assert parsed.hostname == "db.example.supabase.co"
    assert parsed.username == "postgres"
    assert unquote(parsed.password) == "kYez!b$@/x#%"
    assert parsed.path == "/postgres"


def test_db_dsn_requires_template_and_password(monkeypatch):
    sys.modules.pop("src.config", None)
    for name in ("DATABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_JWT_SECRET"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("DB_URL_TEMPLATE", "")
    monkeypatch.setenv("DB_PASSWORD", "")

    config = importlib.import_module("src.config")

    assert config.DB_DSN == ""


def test_database_url_template_requires_password_placeholder(monkeypatch):
    sys.modules.pop("src.config", None)
    for name in ("DATABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_JWT_SECRET"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("DB_URL_TEMPLATE", "postgresql://postgres:password@db.example.supabase.co:5432/postgres")
    monkeypatch.setenv("DB_PASSWORD", "secret")

    with pytest.raises(RuntimeError, match="YOUR-PASSWORD"):
        importlib.import_module("src.config")


def test_auth_compatibility_schema_only_runs_for_local_auth(monkeypatch):
    import src.db as db

    scripts = []

    class FakeConnection:
        def executescript(self, script):
            scripts.append(script)

        def commit(self):
            pass

        def rollback(self):
            pass

        def close(self):
            pass

    monkeypatch.setattr(db, "get_connection", lambda: FakeConnection())

    monkeypatch.setattr(db, "LOCAL_AUTH_ENABLED", False)
    db.init_db()
    assert scripts == [db.SCHEMA]

    scripts.clear()
    monkeypatch.setattr(db, "LOCAL_AUTH_ENABLED", True)
    db.init_db()
    assert scripts == [db.LOCAL_AUTH_SCHEMA, db.SCHEMA]


def test_legacy_database_url_is_rejected(monkeypatch):
    sys.modules.pop("src.config", None)
    monkeypatch.setenv("DATABASE_URL", "postgresql://legacy")
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)

    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        importlib.import_module("src.config")


def test_backend_user_token_can_access_normal_authenticated_endpoint(client):
    response = client.get("/user", headers=auth_headers(make_user_token()))

    assert response.status_code == 200
    assert response.get_json()["user"] == {
        "id": USER_ID,
        "name": "Ada Lovelace",
        "username": "ada",
    }


def test_normal_auth_rejects_missing_expired_invalid_and_unknown_user_tokens(client):
    missing = client.get("/user")
    expired = client.get(
        "/user",
        headers=auth_headers(make_user_token(expires_delta=timedelta(seconds=-1))),
    )
    invalid = client.get("/user", headers=auth_headers("not-a-token"))
    unknown = client.get("/user", headers=auth_headers(make_user_token(UNKNOWN_USER_ID)))

    assert missing.status_code == 401
    assert missing.get_json()["error"] == "Missing bearer token"
    assert expired.status_code == 401
    assert expired.get_json()["error"] == "Token expired"
    assert invalid.status_code == 401
    assert invalid.get_json()["error"] == "Invalid token"
    assert unknown.status_code == 401
    assert unknown.get_json()["error"] == "User not found"


def test_temporary_achievement_token_cannot_access_user_only_routes(client):
    response = client.get("/user", headers=auth_headers(make_temporary_token()))

    assert response.status_code == 403
    assert response.get_json()["error"] == "Token cannot access this endpoint"


def test_user_signup_and_login_proxy_supabase_auth(client):
    signup = client.post(
        "/user",
        json={
            "name": "Grace Hopper",
            "username": "grace",
            "email": "new@example.com",
            "password": "secret123",
        },
    )
    assert signup.status_code == 201
    payload = signup.get_json()
    assert payload["token_type"] == "Bearer"
    assert payload["user"]["username"] == "grace"
    assert jwt.decode(payload["oauth_token"], "backend-secret", algorithms=["HS256"])["scope"] == "user"

    login = client.post("/login", json={"email": "new@example.com", "password": "secret123"})
    assert login.status_code == 200
    assert login.get_json()["user"]["username"] == "grace"


def test_local_auth_signup_and_login(client, monkeypatch):
    monkeypatch.setattr("src.routes.users.LOCAL_AUTH_ENABLED", True)

    signup = client.post(
        "/user",
        json={
            "name": "Local Tester",
            "username": "local",
            "email": "local@example.com",
            "password": "secret123",
        },
    )
    login = client.post(
        "/login",
        json={"email": "local@example.com", "password": "secret123"},
    )
    bad_login = client.post(
        "/login",
        json={"email": "local@example.com", "password": "wrong"},
    )

    assert signup.status_code == 201
    assert signup.get_json()["user"]["username"] == "local"
    assert login.status_code == 200
    assert login.get_json()["user"]["username"] == "local"
    assert bad_login.status_code == 401


def test_user_signup_and_login_validate_errors(client, monkeypatch):
    missing = client.post("/user", json={"username": "ada", "email": "ada@example.com", "password": "secret"})
    duplicate = client.post(
        "/user",
        json={"name": "Ada", "username": "ada", "email": "ada@example.com", "password": "secret"},
    )

    def bad_auth(_path, _payload):
        raise ValueError("bad auth")

    monkeypatch.setattr("src.routes.users._supabase_request", bad_auth)
    bad_login = client.post("/login", json={"email": "ada@example.com", "password": "wrong"})

    assert missing.status_code == 400
    assert missing.get_json()["error"] == "Missing required field(s): name"
    assert duplicate.status_code == 409
    assert duplicate.get_json()["error"] == "Username already exists"
    assert bad_login.status_code == 401
    assert bad_login.get_json()["error"] == "Invalid email or password"


def test_github_oauth_authorize_redirects_to_supabase_with_pkce(client):
    response = client.get("/oauth/github")

    assert response.status_code == 302
    location = response.headers["Location"]
    assert location.startswith("https://")
    assert "/auth/v1/authorize?" in location
    assert "provider=github" in location
    assert "code_challenge=" in location
    assert "redirect_to=http%3A%2F%2Flocalhost%3A8000%2Foauth%2Fgithub%2Fcallback" in location
    assert "state=" not in location


def test_github_oauth_callback_exchanges_code_and_returns_opensauce_token(client, monkeypatch):
    oauth_user_id = "44444444-4444-4444-4444-444444444444"

    def fake_supabase_auth(path, payload, bearer_token=None):
        assert path == "/auth/v1/token?grant_type=pkce"
        assert payload == {"auth_code": "oauth-code", "code_verifier": "verifier"}
        return {
            "access_token": "supabase-token",
            "user": {
                "id": oauth_user_id,
                "email": "octo@example.com",
                "user_metadata": {"user_name": "octocat", "name": "Octo Cat"},
            },
        }

    monkeypatch.setattr("src.routes.oauth.supabase_auth_request", fake_supabase_auth)
    with client.session_transaction() as sess:
        sess["oauth_code_verifier"] = "verifier"

    response = client.get("/oauth/github/callback?code=oauth-code")

    assert response.status_code == 302
    fragment = response.headers["Location"].split("#", 1)[1]
    params = dict(item.split("=", 1) for item in fragment.split("&"))
    decoded = jwt.decode(params["access_token"], "backend-secret", algorithms=["HS256"])
    assert decoded["sub"] == oauth_user_id
    assert decoded["scope"] == "user"


def test_github_oauth_callback_requires_pkce_verifier(client):
    response = client.get("/oauth/github/callback?code=oauth-code")

    assert response.status_code == 400
    assert response.get_json()["error"] == "OAuth verifier was lost."


def test_github_search_supports_pagination(client, monkeypatch):
    calls = []

    def fake_search(query, limit, page):
        calls.append((query, limit, page))
        return {
            "repositories": [{"github_repo": "example/project"}],
            "pagination": {
                "limit": limit,
                "page": page,
                "total": 42,
                "total_pages": 3,
                "has_next": True,
                "has_previous": page > 1,
            },
        }

    monkeypatch.setattr("src.routes.achievements.search_github_repositories", fake_search)

    response = client.get("/github/search?q=react&limit=15&page=2")
    invalid_page = client.get("/github/search?q=react&page=0")

    assert response.status_code == 200
    assert calls == [("react", 15, 2)]
    assert response.get_json()["pagination"]["page"] == 2
    assert response.get_json()["repositories"][0]["github_repo"] == "example/project"
    assert invalid_page.status_code == 400


def test_github_search_uses_application_cache(monkeypatch):
    from src import github

    github.clear_github_cache()
    calls = []

    def fake_github_json(_url, timeout=8):
        calls.append(timeout)
        return {
            "total_count": 1,
            "items": [
                {
                    "full_name": "example/project",
                    "html_url": "https://github.com/example/project",
                    "description": "Example",
                    "language": "Python",
                    "stargazers_count": 10,
                    "forks_count": 2,
                    "open_issues_count": 3,
                }
            ],
        }

    monkeypatch.setattr("src.github._github_json", fake_github_json)

    first = github.search_github_repositories("example", 10, 1)
    second = github.search_github_repositories("example", 10, 1)

    assert first == second
    assert len(calls) == 1


def test_preferences_round_trip_and_validation(client):
    token = make_user_token()
    headers = auth_headers(token)

    initial = client.get("/preferences", headers=headers)
    update = client.put(
        "/preferences",
        json={"categories": ["Backend", "AI / ML"], "notes": "I like APIs."},
        headers=headers,
    )
    after = client.get("/preferences", headers=headers)
    bad_categories = client.put("/preferences", json={"categories": "Backend"}, headers=headers)
    bad_notes = client.put("/preferences", json={"notes": 42}, headers=headers)

    assert initial.status_code == 200
    assert initial.get_json()["preferences"] == {"categories": [], "notes": ""}
    assert update.status_code == 200
    assert after.get_json()["preferences"] == {"categories": ["Backend", "AI / ML"], "notes": "I like APIs."}
    assert bad_categories.status_code == 400
    assert bad_notes.status_code == 400


def test_project_crud_endpoints_are_removed(client):
    response = client.get("/projects")

    assert response.status_code == 404


def test_activity_endpoint_records_and_validates_work(client):
    token = make_user_token()
    headers = auth_headers(token)

    response = client.post(
        "/activity",
        json={"github_repo": "example/project", "type": "started", "url": "https://github.com/example/project/pull/1"},
        headers=headers,
    )
    missing = client.post("/activity", json={"url": "https://github.com/example/project/pull/1"}, headers=headers)
    invalid_repo = client.post(
        "/activity",
        json={"github_repo": "not-a-repo", "url": "https://github.com/example/project/pull/2"},
        headers=headers,
    )

    assert response.status_code == 201
    assert response.get_json()["activity"]["user_id"] == USER_ID
    assert response.get_json()["activity"]["github_repo"] == "example/project"
    assert missing.status_code == 400
    assert invalid_repo.status_code == 400


def test_skill_endpoint_creates_backend_temporary_achievement_jwt(client):
    response = client.post("/skill", json={"user_id": USER_ID, "github_repos": ["example/project"]})

    assert response.status_code == 200
    payload = response.get_json()
    token = payload["temporary_auth"]["oauth_token"]
    decoded = jwt.decode(token, "backend-secret", algorithms=["HS256"])
    assert decoded["scope"] == "achievement"
    assert decoded["sub"] == USER_ID
    assert decoded["assigned_issue"]["github_repo"] == "example/project"


def test_skill_endpoint_supports_get_markdown_and_validation(client, monkeypatch):
    get_response = client.get(f"/skill?user_id={USER_ID}&github_repo=example/project")
    markdown = client.get(f"/skill.md?user_id={USER_ID}&github_repo=example/project")
    missing_repo = client.post("/skill", json={"user_id": USER_ID})
    bad_repo = client.post("/skill", json={"user_id": USER_ID, "github_repos": ["abc"]})
    unknown_user = client.post("/skill", json={"user_id": UNKNOWN_USER_ID, "github_repos": ["example/project"]})

    monkeypatch.setattr("src.routes.achievements.fetch_random_open_issue", lambda _projects: None)
    no_issue = client.post("/skill", json={"user_id": USER_ID, "github_repos": ["example/project"]})

    assert get_response.status_code == 200
    assert get_response.get_json()["github_repos"][0] == "example/project"
    assert markdown.status_code == 200
    assert markdown.mimetype == "text/markdown"
    assert "Open Source Volunteer Agent" in markdown.get_data(as_text=True)
    assert missing_repo.status_code == 400
    assert bad_repo.status_code == 400
    assert unknown_user.status_code == 404
    assert no_issue.status_code == 400


def test_achieve_accepts_valid_temporary_achievement_jwt(client):
    response = client.post(
        "/achieve",
        json={"name": "Contribution", "url": "https://github.com/example/project/pull/1"},
        headers=auth_headers(make_temporary_token()),
    )

    assert response.status_code == 201
    achievement = response.get_json()["achievement"]
    assert achievement["user_id"] == USER_ID
    assert achievement["github_repo"] == "example/project"
    assert achievement["name"] == "Contribution"
    assert achievement["status"] == "submitted"


def test_achieve_accepts_normal_backend_user_token(client):
    response = client.post(
        "/achieve",
        json={"name": "User contribution", "github_repo": "example/project"},
        headers=auth_headers(make_user_token()),
    )

    assert response.status_code == 201
    assert response.get_json()["achievement"]["name"] == "User contribution"


def test_achievements_and_skills_list_with_filters_sorting_and_validation(client):
    token = make_user_token()
    headers = auth_headers(token)
    client.post(
        "/achieve",
        json={
            "name": "Second contribution",
            "github_repo": "example/other",
            "issue_url": "https://github.com/example/other/issues/2",
            "issue_title": "Second issue",
            "issue_number": 2,
            "url": "https://github.com/example/other/pull/2",
        },
        headers=headers,
    )
    client.post(
        "/achieve",
        json={
            "name": "First contribution",
            "github_repo": "example/project",
            "issue_url": "https://github.com/example/project/issues/1",
            "issue_title": "First issue",
            "issue_number": 1,
            "url": "https://github.com/example/project/pull/1",
        },
        headers=headers,
    )

    listed = client.get("/achievements?limit=1&offset=0", headers=headers)
    by_repo = client.get("/achievements?github_repo=example/project", headers=headers)
    by_issue = client.get("/achievements?issue_number=2", headers=headers)
    by_search = client.get("/achievements?q=Second", headers=headers)
    oldest = client.get("/achievements?sort=oldest", headers=headers)
    by_name = client.get("/achievements?sort=name", headers=headers)
    skills = client.get("/skills", headers=headers)

    invalid_limit = client.get("/achievements?limit=0", headers=headers)
    invalid_offset = client.get("/achievements?offset=-1", headers=headers)
    invalid_status = client.get("/achievements?status=unknown", headers=headers)
    invalid_sort = client.get("/achievements?sort=unknown", headers=headers)

    assert listed.status_code == 200
    assert listed.get_json()["pagination"]["has_more"] is True
    assert by_repo.get_json()["achievements"][0]["github_repo"] == "example/project"
    assert by_issue.get_json()["achievements"][0]["issue_number"] == 2
    assert by_search.get_json()["achievements"][0]["name"] == "Second contribution"
    assert oldest.get_json()["achievements"][0]["name"] == "Second contribution"
    assert by_name.get_json()["achievements"][0]["name"] == "First contribution"
    assert skills.status_code == 200
    assert len(skills.get_json()["skills"]) == 2
    assert invalid_limit.status_code == 400
    assert invalid_offset.status_code == 400
    assert invalid_status.status_code == 400
    assert invalid_sort.status_code == 400


def test_achievement_dashboard_and_validation(client):
    token = make_user_token()
    headers = auth_headers(token)
    client.post("/achieve", json={"name": "One", "github_repo": "example/project"}, headers=headers)
    client.post("/achieve", json={"name": "Two", "github_repo": "example/project"}, headers=headers)

    response = client.get("/achievements/dashboard?top_n=1")
    invalid_low = client.get("/achievement/dashboard?top_n=0")
    invalid_text = client.get("/achievement/dashboard?top_n=abc")

    assert response.status_code == 200
    monthly = response.get_json()["windows"]["monthly"]
    assert monthly["top_repositories"][0]["github_repo"] == "example/project"
    assert monthly["top_users"][0]["user_id"] == USER_ID
    assert invalid_low.status_code == 400
    assert invalid_text.status_code == 400


def test_achieve_validates_inputs_and_project_scope(client):
    token = make_user_token()
    headers = auth_headers(token)

    missing_name = client.post("/achieve", json={}, headers=headers)
    missing_repo = client.post("/achieve", json={"name": "Bad"}, headers=headers)
    invalid_repo = client.post("/achieve", json={"name": "Bad", "github_repo": "abc"}, headers=headers)
    invalid_issue = client.post("/achieve", json={"name": "Bad", "issue_number": "abc"}, headers=headers)

    multi_project_token = make_temporary_token(
        projects=[
            {"github_repo": "example/project"},
            {"github_repo": "example/other"},
        ],
        github_repos=["example/project", "example/other"],
    )
    missing_project_for_temporary = client.post(
        "/achieve",
        json={"name": "Bad"},
        headers=auth_headers(multi_project_token),
    )
    by_project_url = client.post(
        "/achieve",
        json={"name": "Good", "github_repo": "example/other"},
        headers=auth_headers(multi_project_token),
    )

    assert missing_name.status_code == 400
    assert missing_repo.status_code == 400
    assert invalid_repo.status_code == 400
    assert invalid_issue.status_code == 400
    assert missing_project_for_temporary.status_code == 400
    assert by_project_url.status_code == 201
    assert by_project_url.get_json()["achievement"]["github_repo"] == "example/other"


def test_achieve_rejects_bad_temporary_tokens(client):
    now = datetime.now(timezone.utc)
    expired = jwt.encode(
        {"sub": USER_ID, "scope": "achievement", "iat": now - timedelta(hours=2), "exp": now - timedelta(hours=1)},
        "backend-secret",
        algorithm="HS256",
    )
    wrong_scope = make_temporary_token(scope="admin")
    unauthorized_project = make_temporary_token(github_repos=["example/project"])

    malformed = client.post("/achieve", json={"name": "Bad"}, headers=auth_headers("bad-token"))
    expired_response = client.post("/achieve", json={"name": "Bad"}, headers=auth_headers(expired))
    wrong_scope_response = client.post("/achieve", json={"name": "Bad"}, headers=auth_headers(wrong_scope))
    unauthorized_response = client.post(
        "/achieve",
        json={"name": "Bad", "github_repo": "example/other"},
        headers=auth_headers(unauthorized_project),
    )

    assert malformed.status_code == 401
    assert malformed.get_json()["error"] == "Invalid token"
    assert expired_response.status_code == 401
    assert expired_response.get_json()["error"] == "Token expired"
    assert wrong_scope_response.status_code == 403
    assert wrong_scope_response.get_json()["error"] == "Token cannot record achievements"
    assert unauthorized_response.status_code == 403
    assert unauthorized_response.get_json()["error"] == "Temporary token cannot record work for this repository"
