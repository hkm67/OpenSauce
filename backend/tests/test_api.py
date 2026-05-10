import importlib
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

import jwt
import pytest


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("SECRET_KEY", "test-secret")

    for module_name in list(sys.modules):
        if module_name == "src" or module_name.startswith("src."):
            sys.modules.pop(module_name)

    app_module = importlib.import_module("src.app")
    app_module.app.config.update(TESTING=True)
    return app_module.app.test_client()


def create_user(client, username="ada"):
    response = client.post(
        "/user",
        json={"name": "Ada Lovelace", "username": username, "password": "secret"},
    )
    assert response.status_code == 201
    return response.get_json()


def login(client, username="ada"):
    response = client.post(
        "/login",
        json={"username": username, "password": "secret"},
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["token_type"] == "Bearer"
    assert payload["oauth_token"]
    return payload["oauth_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def create_project(client, token, url="https://github.com/example/project"):
    response = client.post(
        "/project",
        json={"url": url, "description": "Example project"},
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return response.get_json()


def make_token(user_id, scope="user", **extra):
    payload = {
        "sub": str(user_id),
        "scope": scope,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    payload.update(extra)
    return jwt.encode(payload, "test-secret", algorithm="HS256")


def test_health_endpoint(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_user_creation_and_login(client):
    user = create_user(client)

    assert user == {"id": 1, "name": "Ada Lovelace", "username": "ada"}

    token = login(client)

    assert isinstance(token, str)


def test_current_user_endpoint_returns_authenticated_user(client):
    user = create_user(client)
    token = login(client)

    response = client.get("/user", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.get_json() == {"authenticated": True, "user": user}


def test_duplicate_user_is_rejected(client):
    create_user(client)

    response = client.post(
        "/user",
        json={"name": "Ada Again", "username": "ada", "password": "secret"},
    )

    assert response.status_code == 409
    assert response.get_json()["error"] == "Username already exists"


def test_user_creation_requires_all_fields(client):
    response = client.post("/user", json={"username": "ada", "password": "secret"})

    assert response.status_code == 400
    assert response.get_json()["error"] == "Missing required field(s): name"


def test_login_rejects_invalid_password(client):
    create_user(client)

    response = client.post(
        "/login",
        json={"username": "ada", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid username or password"


def test_login_requires_all_fields(client):
    response = client.post("/login", json={"username": "ada"})

    assert response.status_code == 400
    assert response.get_json()["error"] == "Missing required field(s): password"


def test_project_crud_endpoints(client):
    create_user(client)
    token = login(client)

    project = create_project(client, token)
    assert project["url"] == "https://github.com/example/project"

    list_response = client.get("/projects")
    assert list_response.status_code == 200
    assert list_response.get_json()["projects"][0]["id"] == project["id"]

    delete_response = client.delete(
        "/project",
        json={"id": project["id"]},
        headers=auth_headers(token),
    )
    assert delete_response.status_code == 200
    assert delete_response.get_json() == {"deleted": True}

    projects = client.get("/projects").get_json()["projects"]
    assert all(project["url"] != item["url"] for item in projects)


def test_default_projects_include_telegram_ai_bot(client):
    response = client.get("/projects")

    assert response.status_code == 200
    urls = [project["url"] for project in response.get_json()["projects"]]
    assert "https://github.com/hkm67/telegram-ai-bot/" in urls


def test_project_endpoint_rejects_invalid_mutations(client):
    create_user(client)
    token = login(client)
    headers = auth_headers(token)
    project = create_project(client, token)

    missing_response = client.post(
        "/project",
        json={"url": "https://github.com/example/missing-description"},
        headers=headers,
    )
    duplicate_response = client.post(
        "/project",
        json={"url": project["url"], "description": "Duplicate"},
        headers=headers,
    )
    missing_delete_response = client.delete("/project", json={}, headers=headers)
    unknown_delete_response = client.delete(
        "/project", json={"id": 999}, headers=headers
    )
    url_delete_response = client.delete(
        "/project", json={"url": project["url"]}, headers=headers
    )

    assert missing_response.status_code == 400
    assert duplicate_response.status_code == 409
    assert duplicate_response.get_json()["error"] == "Project URL already exists"
    assert missing_delete_response.status_code == 400
    assert missing_delete_response.get_json()["error"] == "Provide either id or url"
    assert unknown_delete_response.status_code == 404
    assert unknown_delete_response.get_json()["error"] == "Project not found"
    assert url_delete_response.status_code == 200


def test_project_mutations_require_authentication(client):
    response = client.post(
        "/project",
        json={"url": "https://github.com/example/project", "description": "Example"},
    )

    assert response.status_code == 401
    assert response.get_json()["error"] == "Missing bearer token"


def test_protected_endpoints_reject_invalid_expired_and_unknown_user_tokens(client):
    create_user(client)
    expired_token = jwt.encode(
        {
            "sub": "1",
            "scope": "user",
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        },
        "test-secret",
        algorithm="HS256",
    )
    unknown_user_token = make_token(999)

    invalid_response = client.post(
        "/project",
        json={"url": "https://github.com/example/a", "description": "A"},
        headers=auth_headers("not-a-token"),
    )
    expired_response = client.post(
        "/project",
        json={"url": "https://github.com/example/b", "description": "B"},
        headers=auth_headers(expired_token),
    )
    unknown_user_response = client.post(
        "/project",
        json={"url": "https://github.com/example/c", "description": "C"},
        headers=auth_headers(unknown_user_token),
    )

    assert invalid_response.status_code == 401
    assert invalid_response.get_json()["error"] == "Invalid token"
    assert expired_response.status_code == 401
    assert expired_response.get_json()["error"] == "Token expired"
    assert unknown_user_response.status_code == 401
    assert unknown_user_response.get_json()["error"] == "User not found"


def test_activity_endpoint_records_user_project_work(client):
    create_user(client)
    token = login(client)
    project = create_project(client, token)

    response = client.post(
        "/activity",
        json={
            "opensource_id": project["id"],
            "url": "https://github.com/example/project/pull/1",
        },
        headers=auth_headers(token),
    )

    assert response.status_code == 201
    activity = response.get_json()["activity"]
    assert activity["user_id"] == 1
    assert activity["opensource_id"] == project["id"]
    assert activity["url"] == "https://github.com/example/project/pull/1"


def test_activity_endpoint_rejects_missing_or_unknown_project(client):
    create_user(client)
    token = login(client)
    headers = auth_headers(token)

    missing_response = client.post(
        "/activity",
        json={"opensource_id": 1},
        headers=headers,
    )
    unknown_project_response = client.post(
        "/activity",
        json={"opensource_id": 999, "url": "https://github.com/example/pull/1"},
        headers=headers,
    )

    assert missing_response.status_code == 400
    assert missing_response.get_json()["error"] == "Missing required field(s): url"
    assert unknown_project_response.status_code == 404
    assert unknown_project_response.get_json()["error"] == "Project not found"


def test_skill_endpoint_generates_prompt_for_selected_projects(client):
    user = create_user(client)
    token = login(client)
    project = create_project(client, token)

    response = client.post(
        "/skill",
        json={"user_id": user["id"], "project_ids": [project["id"]]},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["prompt_filename"] == "SKILL.md"
    assert payload["projects"] == [project]
    assert payload["temporary_auth"]["scope"] == "achievement"
    assert payload["magic_url"].startswith("http://localhost/skill.md?")
    assert f"project_id={project['id']}" in payload["magic_url"]
    assert "git clone <project-url>" in payload["prompt"]
    assert "POST /achieve" in payload["prompt"]
    assert "https://github.com/example/project" in payload["prompt"]
    achievement_example = payload["prompt"].split("Content-Type: application/json", 1)[1]
    achievement_example = achievement_example.split("```", 1)[0]
    assert "project_id" not in achievement_example


def test_skill_markdown_endpoint_returns_magic_link_content(client):
    user = create_user(client)
    token = login(client)
    project = create_project(client, token)

    response = client.get(f"/skill.md?user_id={user['id']}&project_id={project['id']}")

    assert response.status_code == 200
    assert response.mimetype == "text/markdown"
    content = response.get_data(as_text=True)
    assert "Open Source Volunteer Agent" in content
    assert "https://github.com/example/project" in content


def test_skill_endpoint_supports_get_and_single_project_id(client):
    user = create_user(client)
    token = login(client)
    project = create_project(client, token)

    response = client.get(f"/skill?user_id={user['id']}&project_id={project['id']}")

    assert response.status_code == 200
    assert response.get_json()["projects"] == [project]


def test_skill_endpoint_accepts_null_int_and_string_project_id_shapes(client):
    user = create_user(client)
    token = login(client)
    project = create_project(client, token)

    null_response = client.post(
        "/skill",
        json={"user_id": user["id"], "project_ids": None},
    )
    int_response = client.post(
        "/skill",
        json={"user_id": user["id"], "project_ids": project["id"]},
    )
    string_response = client.post(
        "/skill",
        json={"user_id": user["id"], "project_ids": str(project["id"])},
    )

    assert null_response.status_code == 200
    assert int_response.status_code == 200
    assert string_response.status_code == 200
    assert project in null_response.get_json()["projects"]
    assert int_response.get_json()["projects"] == [project]
    assert string_response.get_json()["projects"] == [project]


def test_skill_endpoint_randomizes_projects_when_missing_project_ids(client):
    user = create_user(client)
    token = login(client)
    create_project(client, token, "https://github.com/example/project-a")
    create_project(client, token, "https://github.com/example/project-b")

    response = client.post("/skill", json={"user_id": user["id"]})

    assert response.status_code == 200
    payload = response.get_json()
    assert len(payload["projects"]) == 3
    assert payload["temporary_auth"]["scope"] == "achievement"
    assert payload["temporary_auth"]["oauth_token"]
    assert all(project["url"].startswith("https://github.com/") for project in payload["projects"])


def test_skill_endpoint_rejects_missing_user_and_invalid_ids(client):
    missing_user_response = client.post("/skill", json={})
    invalid_ids_response = client.post(
        "/skill", json={"user_id": 1, "project_ids": ["abc"]}
    )

    assert missing_user_response.status_code == 400
    assert missing_user_response.get_json()["error"] == "Missing required field(s): user_id"
    assert invalid_ids_response.status_code == 400
    assert invalid_ids_response.get_json()["error"] == "project_ids must be a list of project IDs"


def test_skill_endpoint_rejects_unknown_user(client):
    response = client.post("/skill", json={"user_id": 999})

    assert response.status_code == 404
    assert response.get_json()["error"] == "User not found"


def test_skill_endpoint_rejects_unknown_project_id(client):
    user = create_user(client)

    response = client.post(
        "/skill",
        json={"user_id": user["id"], "project_ids": [999]},
    )

    assert response.status_code == 404
    assert response.get_json()["error"] == "Project not found: 999"


def test_achieve_accepts_normal_user_token(client):
    create_user(client)
    token = login(client)

    response = client.post(
        "/achieve",
        json={"name": "Python", "description": "Built services"},
        headers=auth_headers(token),
    )

    assert response.status_code == 201
    achievement = response.get_json()["achievement"]
    assert achievement["user_id"] == 1
    assert achievement["name"] == "Python"
    assert achievement["description"] == "Built services"


def test_skills_endpoint_lists_current_user_achievements(client):
    create_user(client)
    token = login(client)

    client.post(
        "/achieve",
        json={"name": "React", "description": "Frontend work"},
        headers=auth_headers(token),
    )

    response = client.get("/skills", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.get_json()["skills"][0]["name"] == "React"


def test_achieve_accepts_temporary_skill_token(client):
    user = create_user(client)
    token = login(client)
    project = create_project(client, token)
    skill_response = client.post(
        "/skill",
        json={"user_id": user["id"], "project_ids": [project["id"]]},
    )
    temporary_token = skill_response.get_json()["temporary_auth"]["oauth_token"]

    response = client.post(
        "/achieve",
        json={
            "name": "Open source contribution",
            "description": "Fixed an issue and opened a merge request",
        },
        headers=auth_headers(temporary_token),
    )

    assert response.status_code == 201
    achievement = response.get_json()["achievement"]
    assert achievement["user_id"] == user["id"]
    assert achievement["project_id"] == project["id"]
    assert achievement["name"] == "Open source contribution"


def test_achieve_accepts_temporary_skill_token_with_project_url(client):
    user = create_user(client)
    token = login(client)
    project_a = create_project(client, token, "https://github.com/example/project-a")
    project_b = create_project(client, token, "https://github.com/example/project-b")
    skill_response = client.post(
        "/skill",
        json={"user_id": user["id"], "project_ids": [project_a["id"], project_b["id"]]},
    )
    temporary_token = skill_response.get_json()["temporary_auth"]["oauth_token"]

    response = client.post(
        "/achieve",
        json={
            "name": "Open source contribution",
            "project_url": project_b["url"],
            "url": "https://github.com/example/project-b/pull/1",
            "description": "Fixed an issue and opened a merge request",
        },
        headers=auth_headers(temporary_token),
    )

    assert response.status_code == 201
    achievement = response.get_json()["achievement"]
    assert achievement["user_id"] == user["id"]
    assert achievement["project_id"] == project_b["id"]


def test_achieve_rejects_invalid_project_inputs(client):
    create_user(client)
    token = login(client)

    bad_project_id_response = client.post(
        "/achieve",
        json={"name": "Contribution", "project_id": "abc"},
        headers=auth_headers(token),
    )
    unknown_project_response = client.post(
        "/achieve",
        json={"name": "Contribution", "project_id": 999},
        headers=auth_headers(token),
    )

    assert bad_project_id_response.status_code == 400
    assert bad_project_id_response.get_json()["error"] == "project_id must be an integer"
    assert unknown_project_response.status_code == 404
    assert unknown_project_response.get_json()["error"] == "Project not found"


def test_temporary_achievement_token_rejects_ambiguous_or_wrong_project(client):
    user = create_user(client)
    token = login(client)
    project_a = create_project(client, token, "https://github.com/example/project-a")
    project_b = create_project(client, token, "https://github.com/example/project-b")
    skill_response = client.post(
        "/skill",
        json={"user_id": user["id"], "project_ids": [project_a["id"], project_b["id"]]},
    )
    temporary_token = skill_response.get_json()["temporary_auth"]["oauth_token"]
    headers = auth_headers(temporary_token)

    ambiguous_response = client.post(
        "/achieve",
        json={"name": "Contribution"},
        headers=headers,
    )
    wrong_url_response = client.post(
        "/achieve",
        json={
            "name": "Contribution",
            "project_url": "https://github.com/example/not-selected",
        },
        headers=headers,
    )
    wrong_id_response = client.post(
        "/achieve",
        json={"name": "Contribution", "project_id": 999},
        headers=headers,
    )
    invalid_id_response = client.post(
        "/achieve",
        json={"name": "Contribution", "project_id": "abc"},
        headers=headers,
    )

    assert ambiguous_response.status_code == 400
    assert (
        ambiguous_response.get_json()["error"]
        == "project_id or project_url is required for multi-project temporary tokens"
    )
    assert wrong_url_response.status_code == 403
    assert wrong_id_response.status_code == 403
    assert invalid_id_response.status_code == 400
    assert invalid_id_response.get_json()["error"] == "project_id must be an integer"


def test_legacy_temporary_achievement_token_with_project_ids_only(client):
    user = create_user(client)
    token = login(client)
    project = create_project(client, token)
    legacy_token = make_token(
        user["id"],
        scope="achievement",
        project_ids=[project["id"]],
    )

    response = client.post(
        "/achieve",
        json={"name": "Legacy token contribution"},
        headers=auth_headers(legacy_token),
    )

    assert response.status_code == 201
    assert response.get_json()["achievement"]["project_id"] == project["id"]


def test_achievement_auth_rejects_invalid_scope_and_unknown_user(client):
    invalid_scope_token = make_token(1, scope="other")
    unknown_user_token = make_token(999, scope="achievement", project_ids=[1])

    invalid_scope_response = client.post(
        "/achieve",
        json={"name": "Contribution"},
        headers=auth_headers(invalid_scope_token),
    )
    unknown_user_response = client.post(
        "/achieve",
        json={"name": "Contribution"},
        headers=auth_headers(unknown_user_token),
    )

    assert invalid_scope_response.status_code == 403
    assert invalid_scope_response.get_json()["error"] == "Token cannot record achievements"
    assert unknown_user_response.status_code == 401
    assert unknown_user_response.get_json()["error"] == "User not found"


def test_temporary_skill_token_cannot_access_other_protected_endpoints(client):
    user = create_user(client)
    token = login(client)
    project = create_project(client, token)
    skill_response = client.post(
        "/skill",
        json={"user_id": user["id"], "project_ids": [project["id"]]},
    )
    temporary_token = skill_response.get_json()["temporary_auth"]["oauth_token"]
    headers = auth_headers(temporary_token)

    project_response = client.post(
        "/project",
        json={
            "url": "https://github.com/example/unauthorized",
            "description": "Should not be created",
        },
        headers=headers,
    )
    activity_response = client.post(
        "/activity",
        json={
            "opensource_id": project["id"],
            "url": "https://github.com/example/project/pull/2",
        },
        headers=headers,
    )
    delete_response = client.delete(
        "/project",
        json={"id": project["id"]},
        headers=headers,
    )

    assert project_response.status_code == 403
    assert activity_response.status_code == 403
    assert delete_response.status_code == 403
    assert project_response.get_json()["error"] == "Token cannot access this endpoint"


def test_achieve_requires_authentication(client):
    response = client.post(
        "/achieve",
        json={"name": "Open source contribution"},
    )

    assert response.status_code == 401
    assert response.get_json()["error"] == "Missing bearer token"


def test_achieve_requires_name(client):
    create_user(client)
    token = login(client)

    response = client.post("/achieve", json={}, headers=auth_headers(token))

    assert response.status_code == 400
    assert response.get_json()["error"] == "Missing required field(s): name"


def test_achievement_dashboard_returns_top_repositories_and_users(client):
    ada = create_user(client)
    ada_token = login(client)
    grace = create_user(client, "grace")
    grace_token = login(client, "grace")
    project_a = create_project(client, ada_token, "https://github.com/example/a")
    project_b = create_project(client, ada_token, "https://github.com/example/b")

    for _ in range(2):
        response = client.post(
            "/achieve",
            json={
                "name": "Open source contribution",
                "project_id": project_a["id"],
                "url": "https://github.com/example/a/pull/1",
            },
            headers=auth_headers(ada_token),
        )
        assert response.status_code == 201

    response = client.post(
        "/achieve",
        json={
            "name": "Open source contribution",
            "project_id": project_b["id"],
            "url": "https://github.com/example/b/pull/1",
        },
        headers=auth_headers(grace_token),
    )
    assert response.status_code == 201

    response = client.get("/achievements/dashboard?top_n=1")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["top_n"] == 1

    for window in ("daily", "weekly", "monthly"):
        window_data = payload["windows"][window]
        assert window_data["top_repositories"] == [
            {
                "project_id": project_a["id"],
                "project_url": project_a["url"],
                "project_description": project_a["description"],
                "contributions": 2,
            }
        ]
        assert window_data["top_users"] == [
            {
                "user_id": ada["id"],
                "name": ada["name"],
                "username": ada["username"],
                "contributions": 2,
            }
        ]


def test_achievement_dashboard_rejects_invalid_top_n(client):
    response = client.get("/achievement/dashboard?top_n=0")

    assert response.status_code == 400
    assert response.get_json()["error"] == "top_n must be an integer between 1 and 100"


def test_achievement_dashboard_rejects_non_numeric_top_n(client):
    response = client.get("/achievement/dashboard?top_n=abc")

    assert response.status_code == 400
    assert response.get_json()["error"] == "top_n must be an integer between 1 and 100"


def test_init_db_migrates_legacy_achievement_schema(tmp_path, monkeypatch):
    database_path = tmp_path / "legacy.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE activities (
            user_id INTEGER NOT NULL,
            opensource_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            url TEXT NOT NULL
        );
        CREATE TABLE achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    connection.close()

    monkeypatch.setenv("DATABASE_PATH", str(database_path))
    for module_name in list(sys.modules):
        if module_name == "src" or module_name.startswith("src."):
            sys.modules.pop(module_name)

    db_module = importlib.import_module("src.db")
    db_module.init_db()

    with sqlite3.connect(database_path) as migrated:
        columns = {
            row[1] for row in migrated.execute("PRAGMA table_info(achievements)")
        }

    assert {"project_id", "url"}.issubset(columns)
