# OpenSauce Backend

A small Python 3 backend service for users, open source projects, activities, skills, and achievements. The app uses Flask, SQLite3, and Gunicorn.

## Run Locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
gunicorn --bind 0.0.0.0:8000 wsgi:app
```

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

- `DATABASE_PATH`: SQLite database location. Defaults to `opensauce.db`.
- `SECRET_KEY`: JWT signing secret. Set this to a strong value in production.
- `TOKEN_EXPIRES_SECONDS`: Token lifetime in seconds. Defaults to `86400`.

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
