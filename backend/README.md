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

### Get Skills

```http
GET /skill
Authorization: Bearer <oauth_token>
```

Skills are returned from the user's achievements.

### Add Achievement

```http
POST /achieve
Authorization: Bearer <oauth_token>
Content-Type: application/json

{
  "name": "Python",
  "description": "Built and maintained Python open source services"
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
