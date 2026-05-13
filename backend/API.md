# OpenSauce Backend API

Quick reference for humans and AI agents. The backend is a Flask JSON API. Local default base URL is:

```text
http://localhost:8000
```

Production base URL is:

```text
https://api.opensauce.itdogtics.com
```

## Auth

Most user endpoints require a backend-signed OpenSauce API token:

```http
Authorization: Bearer <oauth_token>
```

`POST /user`, `POST /login`, and GitHub OAuth return normal user tokens with `scope: "user"`.

`GET|POST /skill` returns a temporary achievement token with `scope: "achievement"`. Temporary achievement tokens are only accepted by `POST /achieve`; they cannot access user-only routes.

API endpoints that can create accounts, hit GitHub, or touch heavier database paths are rate limited. Defaults are conservative per API process:

- Auth endpoints: 10 requests per minute.
- Normal authenticated API endpoints: 120 requests per minute.
- Expensive API endpoints that touch GitHub or heavier database paths, including public `/skill` and `/skill.md`: 30 requests per minute.

Error responses are generally:

```json
{ "error": "Message" }
```

## Endpoint Index

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | None | Health check. |
| `POST` | `/user` | None | Sign up and create a profile. |
| `POST` | `/login` | None | Login and return an API token. |
| `GET` | `/user` | User token | Get current authenticated user. |
| `POST` | `/logout` | None | Stateless logout acknowledgement. |
| `GET` | `/oauth/github` | Browser session | Start GitHub OAuth through Supabase. |
| `GET` | `/oauth/github/callback` | Browser session | GitHub OAuth callback; redirects to frontend with token. |
| `GET` | `/preferences` | User token | Get current user's preferences. |
| `PUT` | `/preferences` | User token | Update current user's preferences. |
| `GET` | `/github/search` | User token | Search GitHub repositories. |
| `GET` | `/github/repos/<owner>/<repo>` | User token | Fetch one GitHub repository. |
| `GET` | `/achievements` | User token | List current user's achievements. |
| `GET` | `/achievement/dashboard` | User token | Contribution dashboard. Alias: `/achievements/dashboard`. |
| `GET, POST` | `/skill` | None | Generate an agent skill prompt and temporary achievement token. |
| `GET` | `/skill.md` | None | Return generated skill prompt as Markdown. |
| `POST` | `/achieve` | User or temporary achievement token | Record an achievement/contribution. |
| `POST` | `/achievements/<id>/sync` | User token | Sync a recorded PR achievement from GitHub. |
| `POST` | `/activity` | User token | Record a lightweight activity event. |

## User And Auth

### `POST /user`

Create a user profile and return a normal API token.

Request:

```json
{
  "name": "Ada Lovelace",
  "username": "ada",
  "email": "ada@example.com",
  "password": "secret"
}
```

Response `201`:

```json
{
  "oauth_token": "<token>",
  "token_type": "Bearer",
  "user": { "id": "<user-id>", "name": "Ada Lovelace", "username": "ada" }
}
```

Common errors: missing fields `400`, duplicate username `409`, auth provider failure `400` or `502`.

### `POST /login`

Login with email and password.

Request:

```json
{ "email": "ada@example.com", "password": "secret" }
```

Response `200`:

```json
{
  "oauth_token": "<token>",
  "token_type": "Bearer",
  "user": { "id": "<user-id>", "name": "Ada Lovelace", "username": "ada" }
}
```

### `GET /user`

Requires a normal user token. Temporary achievement tokens are rejected.

Response `200`:

```json
{
  "authenticated": true,
  "user": { "id": "<user-id>", "name": "Ada Lovelace", "username": "ada" }
}
```

### `POST /logout`

Response `200`:

```json
{ "logged_out": true }
```

The backend does not revoke JWTs; clients should delete stored tokens.

## Preferences

### `GET /preferences`

Requires a normal user token.

Response `200`:

```json
{
  "preferences": {
    "categories": ["frontend", "docs"],
    "notes": "Prefer small issues."
  }
}
```

### `PUT /preferences`

Requires a normal user token.

Request:

```json
{
  "categories": ["frontend", "docs"],
  "notes": "Prefer small issues."
}
```

Rules: `categories` must be a list of strings and is stored with at most 20 entries. `notes` must be a string and is stored with at most 1000 characters.

Response `200`:

```json
{
  "preferences": {
    "categories": ["frontend", "docs"],
    "notes": "Prefer small issues."
  }
}
```

## GitHub Helpers

### `GET /github/search`

Search GitHub repositories.

Requires a normal user token.

Query params:

| Name | Default | Notes |
| --- | --- | --- |
| `q` | Empty | Search query. |
| `limit` | `20` | Integer `1..50`. |
| `page` | `1` | Integer `1..34`. |

Response shape is the normalized GitHub search payload returned by the backend GitHub helper.

### `GET /github/repos/<owner>/<repo>`

Fetch one GitHub repository. Example:

```http
GET /github/repos/openai/openai-python
```

Requires a normal user token.

Returns:

```json
{ "repository": { "...": "normalized GitHub repository fields" } }
```

Returns `404` when GitHub has no matching repository.

## Achievements And Skills

Achievement status values:

```text
started, submitted, merged, closed
```

Achievement objects include:

```json
{
  "id": 1,
  "user_id": "<user-id>",
  "github_repo": "owner/repo",
  "github_repo_url": "https://github.com/owner/repo",
  "name": "Open source contribution",
  "description": "Fixed the issue.",
  "url": "https://github.com/owner/repo/pull/123",
  "github_pr_url": "https://github.com/owner/repo/pull/123",
  "github_pr_number": 123,
  "issue_url": "https://github.com/owner/repo/issues/45",
  "issue_title": "Bug title",
  "issue_number": 45,
  "status": "submitted",
  "started_at": "...",
  "submitted_at": "...",
  "merged_at": null,
  "closed_at": null,
  "created_at": "..."
}
```

### `GET /achievements`

Requires a normal user token. Lists the current user's achievements.

Query params:

| Name | Default | Notes |
| --- | --- | --- |
| `limit` | `20` | Integer `1..100`. |
| `offset` | `0` | Integer `>= 0`. |
| `github_repo` or `repo` | None | GitHub repository like `owner/repo`; URLs are accepted and normalized. |
| `issue_number` | None | Integer `>= 1`. |
| `status` | None | One of `started`, `submitted`, `merged`, `closed`. |
| `q` | None | Text search across achievement fields. |
| `sort` | `recent` | One of `recent`, `oldest`, `name`. |

Response `200`:

```json
{
  "achievements": [],
  "pagination": { "limit": 20, "offset": 0, "total": 0, "has_more": false },
  "filters": {
    "github_repo": null,
    "issue_number": null,
    "status": null,
    "q": null,
    "sort": "recent"
  }
}
```

### `GET|POST /skill`

Generate a Markdown skill prompt for an AI coding agent, assign one open unassigned GitHub issue, and return a temporary achievement token.

No user token is required. This lets a user send an agent the generated `magic_url`; the agent can fetch `/skill.md?t=...` and receive the job prompt without first logging into OpenSauce. This endpoint is still rate limited because it touches the database and GitHub.

`GET` query params:

```http
GET /skill?user_id=<user-id>&github_repo=owner/repo
```

Multiple `github_repo` or `github_repos` params are allowed.

`POST` request:

```json
{
  "user_id": "<user-id>",
  "github_repos": ["owner/repo"]
}
```

`github_repo` can also be used instead of `github_repos`. Repository URLs are accepted and normalized.

Response `200`:

```json
{
  "prompt_filename": "SKILL.md",
  "prompt": "# Open Source Volunteer Agent\n...",
  "magic_url": "https://api.opensauce.itdogtics.com/skill.md?t=...",
  "temporary_auth": {
    "oauth_token": "<temporary-achievement-token>",
    "token_type": "Bearer",
    "scope": "achievement",
    "expires_in": 3600
  },
  "github_repos": ["owner/repo"],
  "assigned_issue": {
    "github_repo": "owner/repo",
    "number": 45,
    "title": "Bug title",
    "url": "https://github.com/owner/repo/issues/45"
  },
  "user": { "id": "<user-id>", "name": "Ada Lovelace", "username": "ada" }
}
```

Common errors: missing `user_id`, missing/invalid repo, unknown user `404`, no open unassigned issue available.

### `GET /skill.md`

Returns the same generated prompt as Markdown.

Query params are the same as `GET /skill`. It also accepts `t=<magic-token>` from the `magic_url` returned by `/skill`.

No user token is required. `magic_url` is intended for external coding agents.

Response content type:

```text
text/markdown
```

### `POST /achieve`

Record an achievement. Accepts either a normal user token or a temporary achievement token.

Request with normal user token:

```json
{
  "name": "Open source contribution",
  "github_repo": "owner/repo",
  "description": "Fixed issue #45.",
  "github_pr_url": "https://github.com/owner/repo/pull/123",
  "issue_url": "https://github.com/owner/repo/issues/45",
  "issue_title": "Bug title",
  "issue_number": 45
}
```

Request with temporary achievement token:

```json
{
  "name": "Open source contribution",
  "github_pr_url": "https://github.com/owner/repo/pull/123",
  "description": "Fixed the assigned issue."
}
```

Rules:

- `name` is required.
- Normal user tokens must provide a repository via `github_repo`, `repo`, `github_repo_url`, `project_url`, `issue_url`, `github_pr_url`, or `url`.
- Temporary achievement tokens can only record work for repositories embedded in the token.
- If the temporary token has exactly one repository, `github_repo` can be omitted.
- If the temporary token has an assigned issue, the achievement is forced to that issue. A conflicting `issue_url` is rejected.
- If `github_pr_url` is provided, it must match the selected repository.
- `status` may be one of `started`, `submitted`, `merged`, `closed`. If omitted, a PR URL makes status `submitted`; otherwise status is `started`.

Response `201`:

```json
{ "achievement": { "...": "achievement fields" } }
```

### `POST /achievements/<id>/sync`

Requires a normal user token. Syncs an achievement with a GitHub pull request by fetching the PR state.

Response `200`:

```json
{ "achievement": { "...": "achievement fields" } }
```

Common errors: achievement not found `404`, achievement has no pull request, GitHub fetch failed `502`.

### `GET /achievement/dashboard`

Contribution dashboard. Requires a normal user token. `/achievements/dashboard` is the same endpoint.

Query params:

| Name | Default | Notes |
| --- | --- | --- |
| `top_n` | `10` | Integer `1..100`. |

Response `200`:

```json
{
  "top_n": 10,
  "windows": {
    "daily": {
      "top_repositories": [],
      "top_users": []
    },
    "weekly": {
      "top_repositories": [],
      "top_users": []
    },
    "monthly": {
      "top_repositories": [],
      "top_users": []
    }
  }
}
```

## Activity

### `POST /activity`

Requires a normal user token. Records a lightweight activity event.

Request:

```json
{
  "github_repo": "owner/repo",
  "type": "started",
  "url": "https://github.com/owner/repo/issues/45"
}
```

Rules:

- `github_repo` is required and must normalize to `owner/repo`.
- `type` defaults to `started`.
- `type` must be one of `started`, `submitted`, `merged`, `closed`, `synced`.

Response `201`:

```json
{
  "activity": {
    "id": 1,
    "user_id": "<user-id>",
    "github_repo": "owner/repo",
    "type": "started",
    "timestamp": "...",
    "url": "https://github.com/owner/repo/issues/45"
  }
}
```

## Common Agent Flows

### App user login

1. `POST /login` with email and password.
2. Store `oauth_token`.
3. Send `Authorization: Bearer <oauth_token>` on user-only endpoints.

### Generate work prompt for an AI agent

1. Know the OpenSauce `user_id`.
2. Call `POST /skill` with `user_id` and one or more `github_repos`.
3. Give the returned `prompt` content or `magic_url` to the coding agent.
4. The agent uses `temporary_auth.oauth_token` only for `POST /achieve`.

### Report completed agent work

1. Open a pull request in the target GitHub repository.
2. Call `POST /achieve` with `Authorization: Bearer <temporary-achievement-token>`.
3. Include `name`, `github_pr_url`, and optional `description`.
4. Do not include `github_repo` or `issue_url` when the temporary token already has assigned issue context.
