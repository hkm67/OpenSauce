#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"

BASE_URL="$BASE_URL" python3 - <<'PY'
import json
import os
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

status, repos = request("GET", "/github/search?q=react&limit=1")
assert status == 200 and "repositories" in repos
print(f"ok /github/search ({len(repos['repositories'])} repository result(s))")

print("Authenticated smoke checks require an OpenSauce API token:")
print("  OPENSAUCE_API_TOKEN=... BASE_URL=... ./scripts/smoke-auth.sh")
PY
