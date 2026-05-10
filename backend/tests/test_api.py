import importlib
import sys

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


def test_health_endpoint(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_user_creation_and_login(client):
    user = create_user(client)

    assert user == {"id": 1, "name": "Ada Lovelace", "username": "ada"}

    token = login(client)

    assert isinstance(token, str)


def test_duplicate_user_is_rejected(client):
    create_user(client)

    response = client.post(
        "/user",
        json={"name": "Ada Again", "username": "ada", "password": "secret"},
    )

    assert response.status_code == 409
    assert response.get_json()["error"] == "Username already exists"


def test_login_rejects_invalid_password(client):
    create_user(client)

    response = client.post(
        "/login",
        json={"username": "ada", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid username or password"


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

    assert client.get("/projects").get_json()["projects"] == []


def test_project_mutations_require_authentication(client):
    response = client.post(
        "/project",
        json={"url": "https://github.com/example/project", "description": "Example"},
    )

    assert response.status_code == 401
    assert response.get_json()["error"] == "Missing bearer token"


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
    assert "git clone <project-url>" in payload["prompt"]
    assert "POST /achieve" in payload["prompt"]
    assert "https://github.com/example/project" in payload["prompt"]


def test_skill_endpoint_randomizes_projects_when_missing_project_ids(client):
    user = create_user(client)
    token = login(client)
    create_project(client, token, "https://github.com/example/project-a")
    create_project(client, token, "https://github.com/example/project-b")

    response = client.post("/skill", json={"user_id": user["id"]})

    assert response.status_code == 200
    payload = response.get_json()
    assert len(payload["projects"]) == 2
    assert payload["temporary_auth"]["scope"] == "achievement"


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
    assert achievement["name"] == "Open source contribution"


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
