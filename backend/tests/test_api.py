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
                "opensource_id": params[1],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "url": params[2],
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
                "project_id": params[1],
                "name": params[2],
                "description": params[3],
                "url": params[4],
                "issue_url": params[5],
                "issue_title": params[6],
                "issue_number": params[7],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self.achievements.append(achievement)
            return FakeCursor(lastrowid=achievement["id"])

        if "from achievements where id" in sql:
            row = next((a for a in self.achievements if a["id"] == int(params[0])), None)
            return FakeCursor([row] if row else [])

        if "select count(*) as total from achievements" in sql:
            return FakeCursor([{"total": len(self._filter_achievements(sql, params))}])

        if "from achievements a left join projects p" in sql:
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

        if "from achievements a join projects p" in sql:
            rows = []
            for project in self.projects:
                count = sum(1 for a in self.achievements if a["project_id"] == project["id"])
                if count:
                    rows.append({
                        "project_id": project["id"],
                        "project_url": project["url"],
                        "project_description": project["description"],
                        "contributions": count,
                    })
            return FakeCursor(sorted(rows, key=lambda r: (-r["contributions"], r["project_id"]))[: int(params[1])])

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
                    })
            return FakeCursor(sorted(rows, key=lambda r: (-r["contributions"], r["user_id"]))[: int(params[1])])

        return FakeCursor([])

    def _filter_achievements(self, sql, params):
        rows = [a for a in self.achievements if a["user_id"] == params[0]]
        idx = 1
        if "a.project_id =" in sql:
            rows = [a for a in rows if a["project_id"] == int(params[idx])]
            idx += 1
        if "a.issue_number =" in sql:
            rows = [a for a in rows if a["issue_number"] == int(params[idx])]
            idx += 1
        if " ilike " in sql:
            needle = str(params[idx]).strip("%").lower()
            def haystack(row):
                project = next((p for p in self.projects if p["id"] == row["project_id"]), {})
                fields = [row.get("name"), row.get("description"), row.get("url"), row.get("issue_title"), row.get("issue_url"), project.get("url")]
                return " ".join(str(field or "") for field in fields).lower()
            rows = [a for a in rows if needle in haystack(a)]
        return rows

    def _achievement_row(self, row):
        project = next((p for p in self.projects if p["id"] == row["project_id"]), None)
        out = dict(row)
        out["project_url"] = project["url"] if project else None
        out["project_description"] = project["description"] if project else None
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

    @contextmanager
    def fake_transaction():
        yield fake_db

    monkeypatch.setattr("src.auth.get_connection", lambda: fake_db)
    monkeypatch.setattr("src.routes.users.get_connection", lambda: fake_db)
    monkeypatch.setattr("src.routes.projects.get_connection", lambda: fake_db)
    monkeypatch.setattr("src.routes.activities.get_connection", lambda: fake_db)
    monkeypatch.setattr("src.routes.achievements.get_connection", lambda: fake_db)
    monkeypatch.setattr("src.routes.users.transaction", fake_transaction)
    monkeypatch.setattr("src.routes.projects.transaction", fake_transaction)
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
        lambda projects: {
            "project_id": projects[0]["id"],
            "project_url": projects[0]["url"],
            "number": 42,
            "title": "Fix flaky contribution flow",
            "url": f"{projects[0]['url'].rstrip('/')}/issues/42",
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
        "projects": [{"id": 1, "url": "https://github.com/example/project", "description": "Example"}],
        "project_ids": [1],
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    payload.update(extra)
    return jwt.encode(payload, "backend-secret", algorithm="HS256")


def create_project(client, token, url="https://github.com/example/new"):
    response = client.post(
        "/project",
        json={"url": url, "description": "New project"},
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return response.get_json()


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


def test_project_crud_endpoints(client):
    token = make_user_token()

    project = create_project(client, token)
    assert project["url"] == "https://github.com/example/new"

    listed = client.get("/projects")
    assert listed.status_code == 200
    assert listed.get_json()["projects"][0]["url"] == project["url"]

    duplicate = client.post(
        "/project",
        json={"url": project["url"], "description": "Duplicate"},
        headers=auth_headers(token),
    )
    missing = client.post(
        "/project",
        json={"url": "https://github.com/example/missing-description"},
        headers=auth_headers(token),
    )
    missing_auth = client.post("/project", json={"url": "x", "description": "x"})
    missing_delete = client.delete("/project", json={}, headers=auth_headers(token))
    unknown_delete = client.delete("/project", json={"id": 999}, headers=auth_headers(token))
    deleted = client.delete("/project", json={"url": project["url"]}, headers=auth_headers(token))

    assert duplicate.status_code == 409
    assert missing.status_code == 400
    assert missing_auth.status_code == 401
    assert missing_delete.status_code == 400
    assert unknown_delete.status_code == 404
    assert deleted.status_code == 200


def test_activity_endpoint_records_and_validates_work(client):
    token = make_user_token()
    headers = auth_headers(token)

    response = client.post(
        "/activity",
        json={"opensource_id": 1, "url": "https://github.com/example/project/pull/1"},
        headers=headers,
    )
    missing = client.post("/activity", json={"opensource_id": 1}, headers=headers)
    unknown_project = client.post(
        "/activity",
        json={"opensource_id": 999, "url": "https://github.com/example/project/pull/2"},
        headers=headers,
    )

    assert response.status_code == 201
    assert response.get_json()["activity"]["user_id"] == USER_ID
    assert missing.status_code == 400
    assert unknown_project.status_code == 404


def test_skill_endpoint_creates_backend_temporary_achievement_jwt(client):
    response = client.post("/skill", json={"user_id": USER_ID, "project_ids": [1]})

    assert response.status_code == 200
    payload = response.get_json()
    token = payload["temporary_auth"]["oauth_token"]
    decoded = jwt.decode(token, "backend-secret", algorithms=["HS256"])
    assert decoded["scope"] == "achievement"
    assert decoded["sub"] == USER_ID
    assert decoded["assigned_issue"]["project_id"] == 1


def test_skill_endpoint_supports_get_markdown_random_and_validation(client, monkeypatch):
    get_response = client.get(f"/skill?user_id={USER_ID}&project_id=1")
    markdown = client.get(f"/skill.md?user_id={USER_ID}&project_id=1")
    random_response = client.post("/skill", json={"user_id": USER_ID})
    bad_ids = client.post("/skill", json={"user_id": USER_ID, "project_ids": ["abc"]})
    unknown_user = client.post("/skill", json={"user_id": UNKNOWN_USER_ID})
    unknown_project = client.post("/skill", json={"user_id": USER_ID, "project_ids": [999]})

    monkeypatch.setattr("src.routes.achievements.fetch_random_open_issue", lambda _projects: None)
    no_issue = client.post("/skill", json={"user_id": USER_ID, "project_ids": [1]})

    assert get_response.status_code == 200
    assert get_response.get_json()["projects"][0]["id"] == 1
    assert markdown.status_code == 200
    assert markdown.mimetype == "text/markdown"
    assert "Open Source Volunteer Agent" in markdown.get_data(as_text=True)
    assert random_response.status_code == 200
    assert len(random_response.get_json()["projects"]) == 3
    assert bad_ids.status_code == 400
    assert unknown_user.status_code == 404
    assert unknown_project.status_code == 404
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
    assert achievement["project_id"] == 1
    assert achievement["name"] == "Contribution"


def test_achieve_accepts_normal_backend_user_token(client):
    response = client.post(
        "/achieve",
        json={"name": "User contribution", "project_id": 1},
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
            "project_id": 2,
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
            "project_id": 1,
            "issue_url": "https://github.com/example/project/issues/1",
            "issue_title": "First issue",
            "issue_number": 1,
            "url": "https://github.com/example/project/pull/1",
        },
        headers=headers,
    )

    listed = client.get("/achievements?limit=1&offset=0", headers=headers)
    by_project = client.get("/achievements?project_id=1", headers=headers)
    by_issue = client.get("/achievements?issue_number=2", headers=headers)
    by_search = client.get("/achievements?q=Second", headers=headers)
    oldest = client.get("/achievements?sort=oldest", headers=headers)
    by_name = client.get("/achievements?sort=name", headers=headers)
    skills = client.get("/skills", headers=headers)

    invalid_limit = client.get("/achievements?limit=0", headers=headers)
    invalid_offset = client.get("/achievements?offset=-1", headers=headers)
    invalid_project = client.get("/achievements?project_id=abc", headers=headers)
    invalid_sort = client.get("/achievements?sort=unknown", headers=headers)

    assert listed.status_code == 200
    assert listed.get_json()["pagination"]["has_more"] is True
    assert by_project.get_json()["achievements"][0]["project_id"] == 1
    assert by_issue.get_json()["achievements"][0]["issue_number"] == 2
    assert by_search.get_json()["achievements"][0]["name"] == "Second contribution"
    assert oldest.get_json()["achievements"][0]["name"] == "Second contribution"
    assert by_name.get_json()["achievements"][0]["name"] == "First contribution"
    assert skills.status_code == 200
    assert len(skills.get_json()["skills"]) == 2
    assert invalid_limit.status_code == 400
    assert invalid_offset.status_code == 400
    assert invalid_project.status_code == 400
    assert invalid_sort.status_code == 400


def test_achievement_dashboard_and_validation(client):
    token = make_user_token()
    headers = auth_headers(token)
    client.post("/achieve", json={"name": "One", "project_id": 1}, headers=headers)
    client.post("/achieve", json={"name": "Two", "project_id": 1}, headers=headers)

    response = client.get("/achievements/dashboard?top_n=1")
    invalid_low = client.get("/achievement/dashboard?top_n=0")
    invalid_text = client.get("/achievement/dashboard?top_n=abc")

    assert response.status_code == 200
    monthly = response.get_json()["windows"]["monthly"]
    assert monthly["top_repositories"][0]["project_id"] == 1
    assert monthly["top_users"][0]["user_id"] == USER_ID
    assert invalid_low.status_code == 400
    assert invalid_text.status_code == 400


def test_achieve_validates_inputs_and_project_scope(client):
    token = make_user_token()
    headers = auth_headers(token)

    missing_name = client.post("/achieve", json={}, headers=headers)
    invalid_project = client.post("/achieve", json={"name": "Bad", "project_id": "abc"}, headers=headers)
    unknown_project = client.post("/achieve", json={"name": "Bad", "project_id": 999}, headers=headers)
    invalid_issue = client.post("/achieve", json={"name": "Bad", "issue_number": "abc"}, headers=headers)

    multi_project_token = make_temporary_token(
        projects=[
            {"id": 1, "url": "https://github.com/example/project", "description": "Example"},
            {"id": 2, "url": "https://github.com/example/other", "description": "Other"},
        ],
        project_ids=[1, 2],
    )
    missing_project_for_temporary = client.post(
        "/achieve",
        json={"name": "Bad"},
        headers=auth_headers(multi_project_token),
    )
    by_project_url = client.post(
        "/achieve",
        json={"name": "Good", "project_url": "https://github.com/example/other"},
        headers=auth_headers(multi_project_token),
    )

    assert missing_name.status_code == 400
    assert invalid_project.status_code == 400
    assert unknown_project.status_code == 404
    assert invalid_issue.status_code == 400
    assert missing_project_for_temporary.status_code == 400
    assert by_project_url.status_code == 201
    assert by_project_url.get_json()["achievement"]["project_id"] == 2


def test_achieve_rejects_bad_temporary_tokens(client):
    now = datetime.now(timezone.utc)
    expired = jwt.encode(
        {"sub": USER_ID, "scope": "achievement", "iat": now - timedelta(hours=2), "exp": now - timedelta(hours=1)},
        "backend-secret",
        algorithm="HS256",
    )
    wrong_scope = make_temporary_token(scope="admin")
    unauthorized_project = make_temporary_token(projects=[{"id": 1}], project_ids=[1])

    malformed = client.post("/achieve", json={"name": "Bad"}, headers=auth_headers("bad-token"))
    expired_response = client.post("/achieve", json={"name": "Bad"}, headers=auth_headers(expired))
    wrong_scope_response = client.post("/achieve", json={"name": "Bad"}, headers=auth_headers(wrong_scope))
    unauthorized_response = client.post(
        "/achieve",
        json={"name": "Bad", "project_id": 2},
        headers=auth_headers(unauthorized_project),
    )

    assert malformed.status_code == 401
    assert malformed.get_json()["error"] == "Invalid token"
    assert expired_response.status_code == 401
    assert expired_response.get_json()["error"] == "Token expired"
    assert wrong_scope_response.status_code == 403
    assert wrong_scope_response.get_json()["error"] == "Token cannot record achievements"
    assert unauthorized_response.status_code == 403
    assert unauthorized_response.get_json()["error"] == "Temporary token cannot record work for this project"
