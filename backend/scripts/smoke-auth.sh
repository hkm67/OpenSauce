#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
: "${OPENSAUCE_API_TOKEN:?Set OPENSAUCE_API_TOKEN to a real OpenSauce API token from /login.}"

BASE_URL="$BASE_URL" OPENSAUCE_API_TOKEN="$OPENSAUCE_API_TOKEN" python3 - <<'PY'
import json
import os
import urllib.error
import urllib.request


base_url = os.environ["BASE_URL"].rstrip("/")
token = os.environ["OPENSAUCE_API_TOKEN"]


def request(method, path, payload=None, bearer=None):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"

    req = urllib.request.Request(f"{base_url}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body) if body else None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = body
        raise SystemExit(f"{method} {path} failed: {exc.code} {parsed}") from exc


status, current = request("GET", "/user", bearer=token)
assert status == 200 and current["user"]["id"]
user_id = current["user"]["id"]
print("ok /user")

status, projects = request("GET", "/projects")
assert status == 200 and projects["projects"]
project_id = projects["projects"][0]["id"]
print("ok /projects")

status, skill = request("POST", "/skill", {"user_id": user_id, "project_ids": [project_id]})
assert status == 200 and skill["temporary_auth"]["oauth_token"]
print("ok /skill")

status, achievement = request(
    "POST",
    "/achieve",
    {
        "name": "Smoke contribution",
        "url": "https://github.com/example/project/pull/1",
        "description": "Smoke test achievement",
    },
    bearer=skill["temporary_auth"]["oauth_token"],
)
assert status == 201
print("ok /achieve")
PY
