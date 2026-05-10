# OpenSauce Backend

A small Python 3 backend service for users, open source projects, activities, skills, and achievements. The app uses Flask, SQLite3, and Gunicorn.

## Run Locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Start Gunicorn. On Linux/macOS, **bind both IPv4 and IPv6 loopback** so `http://localhost:8000` works in browsers that resolve `localhost` to `::1` first:

```bash
gunicorn --bind 0.0.0.0:8000 --bind '[::1]:8000' wsgi:app
```

If you only use **`http://127.0.0.1:8000`**, a single bind is enough:

```bash
gunicorn --bind 127.0.0.1:8000 wsgi:app
```

### Smoke test

With the server running:

```bash
./scripts/smoke.sh
```

### If `/health` looks “blank” in the browser

- Try **`http://127.0.0.1:8000/health`** instead of `localhost`.
- Confirm the server is running and bound correctly (see binds above).
- Open DevTools → **Network** and check for **failed** requests (often **connection refused** on IPv6).

### If GitHub callback returns “Invalid OAuth state” or “OAuth session was lost”

The app is set up for **`http://localhost:8000`**. Requests to **`127.0.0.1`** or **`[::1]`** are **307 redirected to `localhost`** so the session cookie matches **GitHub’s callback URL**. Set **GitHub’s Authorization callback URL** and **`GITHUB_REDIRECT_URI`** to **`http://localhost:8000/oauth/github/callback`**.

The service initializes the SQLite database automatically on startup. By default it writes to `opensauce.db` in the project root.

## Run With Docker

```bash
docker compose up --build
```

The API will be available at `http://localhost:8000`.

## Run Tests

```bash
pip install -r requirements.txt
python3 -m pytest
python3 -m coverage run --source=src -m pytest tests/test_api.py
python3 -m coverage report -m
```

## Environment Variables

Copy `.env.example` to `.env` in this directory (`backend/.env`). `python-dotenv` loads it automatically.

- `DATABASE_PATH`: SQLite database location. Defaults to `opensauce.db`.
- `SECRET_KEY`: JWT signing secret and Flask session key. Set this to a strong value in production.
- `TOKEN_EXPIRES_SECONDS`: Token lifetime in seconds. Defaults to `86400`.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: GitHub OAuth App credentials ([OAuth Apps](https://github.com/settings/developers)).
- `GITHUB_REDIRECT_URI`: Must match the **Authorization callback URL** on the GitHub OAuth app exactly. Defaults to `http://localhost:8000/oauth/github/callback`.
- `OAUTH_SUCCESS_REDIRECT` (optional): After GitHub login, **302 redirect** here. The JWT is **not** in the query string. An **HttpOnly** cookie (`AUTH_COOKIE_NAME`, default `opensauce_token`) is always set on the **API** origin for same-origin requests with `credentials: 'include'`.
- `OAUTH_TOKEN_IN_FRAGMENT` (optional): If `1`, append `#access_token=…&token_type=Bearer` to the redirect URL so a SPA on another origin (e.g. port 3000) can read the token from `window.location.hash` (still visible to JS; prefer same-origin + cookie when you can).
- `AUTH_COOKIE_SECURE`: Set to `1` in production behind **HTTPS** (sets `Secure` on the cookie).
- `OAUTH_JSON_RESPONSE`: If `1`, the callback returns JSON with `oauth_token` (local API testing only; avoid in production).

## API

### Health

```http
GET /health
```

### Create User

```http
POST /user
Content-Type: application/json

{
  "name": "Ada Lovelace",
  "username": "ada",
  "password": "secret"
}
```

### Login

```http
POST /login
Content-Type: application/json

{
  "username": "ada",
  "password": "secret"
}
```

Returns:

```json
{
  "oauth_token": "...",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "name": "Ada Lovelace",
    "username": "ada"
  }
}
```

Use protected routes with:

```http
Authorization: Bearer <oauth_token>
```

### GitHub OAuth (browser)

There is no separate frontend repo in this branch yet: **`GET /`** on the API serves a tiny HTML page with a **Sign in with GitHub** link for local testing. For your GitHub OAuth app, set **Homepage URL** to the same host as the API (e.g. `http://localhost:8000`).

1. Register an OAuth App on GitHub with callback URL `http://localhost:8000/oauth/github/callback` (or your deployed URL + `/oauth/github/callback`).
2. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`.
3. Open **`http://localhost:8000/`** or **`GET /oauth/github`**. After GitHub redirects to **`/oauth/github/callback`**, the API sets an **HttpOnly** JWT cookie and **302 redirects** to `OAUTH_SUCCESS_REDIRECT` (or **`/oauth/welcome`** if unset). Use **`POST /logout`** to clear the cookie. For the old JSON callback, set **`OAUTH_JSON_RESPONSE=1`** (dev only).

Password-based **`POST /login`** remains available for accounts created with **`POST /user`**.

### List Projects

```http
GET /projects
```

### Create Project

```http
POST /project
Authorization: Bearer <oauth_token>
Content-Type: application/json

{
  "url": "https://github.com/example/project",
  "description": "A useful open source project"
}
```

### Delete Project

```http
DELETE /project
Authorization: Bearer <oauth_token>
Content-Type: application/json

{
  "id": 1
}
```

You can also delete by `url`.

### Generate Skill Prompt

```http
POST /skill
Content-Type: application/json

{
  "user_id": 1,
  "project_ids": [1, 2]
}
```

This endpoint does not require authentication. It fetches the selected project URLs and returns SKILL.md prompt content for an agent, plus a temporary achievement token scoped to `/achieve`. If `project_ids` is missing or empty, the API randomly selects up to 3 available projects.

Returns:

```json
{
  "prompt_filename": "SKILL.md",
  "prompt": "# Open Source Volunteer Agent\n...",
  "temporary_auth": {
    "oauth_token": "...",
    "token_type": "Bearer",
    "scope": "achievement",
    "expires_in": 3600
  },
  "projects": [
    {
      "id": 1,
      "url": "https://github.com/example/project",
      "description": "A useful open source project"
    }
  ],
  "user": {
    "id": 1,
    "name": "Ada Lovelace",
    "username": "ada"
  }
}
```

`GET /skill?user_id=1&project_id=1&project_id=2` is also supported.

### Add Achievement

```http
POST /achieve
Authorization: Bearer <oauth_token-or-temporary-achievement-token>
Content-Type: application/json

{
  "name": "Open source contribution",
  "url": "https://github.com/example/project/pull/34",
  "description": "Fixed https://github.com/example/project/issues/12 and opened https://github.com/example/project/pull/34"
}
```

Temporary achievement tokens embed the selected project context and are limited to those projects. If a temporary token was generated for exactly one project, `project_id` is filled automatically when omitted. If the token contains multiple projects, include either `project_id` or `project_url` in the `/achieve` request.

### Achievement Dashboard

```http
GET /achievements/dashboard?top_n=5
```

Returns the most contributed repositories and users for daily, weekly, and monthly windows. `top_n` defaults to `10` and must be between `1` and `100`.

`GET /achievement/dashboard?top_n=5` is also supported.

```json
{
  "top_n": 5,
  "windows": {
    "daily": {
      "top_repositories": [
        {
          "project_id": 1,
          "project_url": "https://github.com/example/project",
          "project_description": "A useful open source project",
          "contributions": 3
        }
      ],
      "top_users": [
        {
          "user_id": 1,
          "name": "Ada Lovelace",
          "username": "ada",
          "contributions": 3
        }
      ]
    }
  }
}
```

### Add Activity

The activity table was included in the DB requirements, so this service also exposes an activity endpoint.

```http
POST /activity
Authorization: Bearer <oauth_token>
Content-Type: application/json

{
  "opensource_id": 1,
  "url": "https://github.com/example/project/pull/1"
}
```
