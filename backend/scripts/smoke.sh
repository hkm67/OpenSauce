#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"

BASE_URL="$BASE_URL" python3 - <<'PY'
import json
import os
import time
import urllib.error
import urllib.request


base_url = os.environ["BASE_URL"].rstrip("/")


def request(method, path, payload=None, token=None):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(
        f"{base_url}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body) if body else None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = body
        raise SystemExit(f"{method} {path} failed: {exc.code} {parsed}") from exc


status, health = request("GET", "/health")
assert status == 200 and health == {"status": "ok"}
print("ok /health")

status, projects = request("GET", "/projects")
assert status == 200 and projects["projects"]
project_id = projects["projects"][0]["id"]
print(f"ok /projects ({len(projects['projects'])} project(s))")

username = f"smoke-{int(time.time())}"
status, user = request(
    "POST",
    "/user",
    {"name": "Smoke User", "username": username, "password": "secret"},
)
assert status == 201
print("ok /user")

status, login = request("POST", "/login", {"username": username, "password": "secret"})
assert status == 200 and login["oauth_token"]
print("ok /login")

status, skill = request(
    "POST",
    "/skill",
    {"user_id": user["id"], "project_ids": [project_id]},
)
assert status == 200 and skill["assigned_issue"] and skill["temporary_auth"]["oauth_token"]
print(f"ok /skill assigned issue #{skill['assigned_issue']['number']}")

status, achievement = request(
    "POST",
    "/achieve",
    {
        "name": "Smoke contribution",
        "url": "https://github.com/example/project/pull/1",
        "description": "Smoke test achievement",
    },
    token=skill["temporary_auth"]["oauth_token"],
)
assert status == 201 and achievement["achievement"]["issue_url"]
print("ok /achieve")
PY
