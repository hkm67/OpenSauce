#!/usr/bin/env bash
set -euo pipefail

DEFAULT_TARGETS="https://opensauce-api.onrender.com https://api.opensauce.itdogtics.com"
TARGETS="${TARGETS:-$DEFAULT_TARGETS}"

: "${OPENSAUCE_EMAIL:?Set OPENSAUCE_EMAIL to a real test account email.}"
: "${OPENSAUCE_PASSWORD:?Set OPENSAUCE_PASSWORD to the test account password.}"

TARGETS="$TARGETS" OPENSAUCE_EMAIL="$OPENSAUCE_EMAIL" OPENSAUCE_PASSWORD="$OPENSAUCE_PASSWORD" python3 - <<'PY'
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request


targets = [target.rstrip("/") for target in os.environ["TARGETS"].split() if target.strip()]
email = os.environ["OPENSAUCE_EMAIL"]
password = os.environ["OPENSAUCE_PASSWORD"]


class SmokeFailure(Exception):
    pass


def request(base_url, method, path, payload=None, token=None, expected=(200,), timeout=30, parse_json=True):
    data = None
    headers = {"Accept": "application/json"}
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
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            parsed = json.loads(body) if body and parse_json else body
            if response.status not in expected:
                raise SmokeFailure(f"{method} {path}: expected {expected}, got {response.status} {parsed}")
            return response.status, parsed
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            parsed = json.loads(body) if body else body
        except json.JSONDecodeError:
            parsed = body
        if exc.code in expected:
            return exc.code, parsed
        raise SmokeFailure(f"{method} {path}: expected {expected}, got {exc.code} {parsed}") from exc


def ok(label):
    print(f"  ok {label}")


def run_target(base_url):
    print(f"\n== {base_url} ==")

    status, health = request(base_url, "GET", "/health")
    assert health == {"status": "ok"}
    ok("/health")

    status, home = request(base_url, "GET", "/", expected=(200,), timeout=15, parse_json=False)
    ok("/")

    status, projects_payload = request(base_url, "GET", "/projects")
    projects = projects_payload.get("projects") or []
    if not projects:
        raise SmokeFailure("/projects returned no projects")
    project = projects[0]
    ok(f"/projects ({len(projects)} project(s))")

    status, dashboard = request(base_url, "GET", "/achievements/dashboard?top_n=5")
    assert dashboard.get("top_n") == 5 and "windows" in dashboard
    ok("/achievements/dashboard")

    request(base_url, "GET", "/achievements", expected=(401,))
    ok("/achievements rejects missing token")

    request(base_url, "GET", "/skills", expected=(401,))
    ok("/skills rejects missing token")

    request(base_url, "GET", "/preferences", expected=(401,))
    ok("/preferences rejects missing token")

    request(base_url, "POST", "/activity", {"opensource_id": project["id"], "url": "https://github.com/example/project/pull/0"}, expected=(401,))
    ok("/activity rejects missing token")

    request(base_url, "POST", "/project", {"url": "https://github.com/example/smoke", "description": "Smoke"}, expected=(401,))
    ok("/project rejects missing token")

    request(base_url, "DELETE", "/project", {"id": project["id"]}, expected=(401,))
    ok("DELETE /project rejects missing token")

    request(base_url, "POST", "/logout", expected=(200,))
    ok("/logout")

    status, login = request(base_url, "POST", "/login", {"email": email, "password": password})
    token = login.get("oauth_token")
    user = login.get("user") or {}
    user_id = user.get("id")
    if not token or not user_id:
        raise SmokeFailure("/login did not return token and user id")
    ok("/login")

    status, current = request(base_url, "GET", "/user", token=token)
    assert current["authenticated"] is True and current["user"]["id"] == user_id
    ok("/user")

    status, preferences = request(base_url, "GET", "/preferences", token=token)
    assert "preferences" in preferences
    ok("GET /preferences")

    marker = f"production-smoke-{int(time.time())}"
    status, saved_preferences = request(
        base_url,
        "PUT",
        "/preferences",
        {"categories": ["Documentation", "Testing"], "notes": marker},
        token=token,
    )
    assert saved_preferences["preferences"]["notes"] == marker
    ok("PUT /preferences")

    status, achievements = request(base_url, "GET", "/achievements?limit=5&offset=0&sort=recent", token=token)
    assert "achievements" in achievements and "pagination" in achievements
    ok("/achievements")

    status, skills = request(base_url, "GET", "/skills?limit=5", token=token)
    assert "skills" in skills and "pagination" in skills
    ok("/skills")

    activity_url = f"https://github.com/example/project/pull/{int(time.time())}"
    status, activity = request(
        base_url,
        "POST",
        "/activity",
        {"opensource_id": project["id"], "url": activity_url},
        token=token,
        expected=(201,),
    )
    assert activity["activity"]["opensource_id"] == project["id"]
    ok("/activity")

    achievement_name = f"Production smoke {int(time.time())}"
    status, achievement = request(
        base_url,
        "POST",
        "/achieve",
        {
            "project_id": project["id"],
            "name": achievement_name,
            "url": activity_url,
            "description": "Production smoke test achievement",
        },
        token=token,
        expected=(201,),
    )
    assert achievement["achievement"]["name"] == achievement_name
    ok("/achieve with user token")

    skill_query = urllib.parse.urlencode({"user_id": user_id, "project_id": project["id"]})
    status, skill_or_error = request(
        base_url,
        "GET",
        f"/skill?{skill_query}",
        expected=(200, 404),
        timeout=45,
    )
    if status == 200:
        temporary_token = skill_or_error["temporary_auth"]["oauth_token"]
        ok("/skill")
        status, markdown = request(
            base_url,
            "GET",
            f"/skill.md?{skill_query}",
            expected=(200, 404),
            timeout=45,
            parse_json=False,
        )
        ok("/skill.md")
        status, temp_achievement = request(
            base_url,
            "POST",
            "/achieve",
            {
                "name": f"Production smoke temporary {int(time.time())}",
                "url": activity_url,
                "description": "Production smoke temporary-token achievement",
            },
            token=temporary_token,
            expected=(201,),
        )
        assert temp_achievement["achievement"]["name"].startswith("Production smoke temporary")
        ok("/achieve with temporary token")
    else:
        message = skill_or_error.get("error") if isinstance(skill_or_error, dict) else skill_or_error
        print(f"  skip /skill temporary-token path: {message}")

    oauth_status, _ = request(base_url, "GET", "/oauth/github", expected=(302,), timeout=15)
    assert oauth_status == 302
    ok("/oauth/github redirects")


failures = []
for target in targets:
    try:
        run_target(target)
    except Exception as exc:
        failures.append(f"{target}: {exc}")

if failures:
    print("\nSmoke test failures:")
    for failure in failures:
        print(f" - {failure}")
    raise SystemExit(1)

print("\nProduction smoke tests passed.")
PY
