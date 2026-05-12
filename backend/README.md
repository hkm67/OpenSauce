# OpenSauce Backend

Flask API for users, projects, activities, skill prompts, and achievements. The browser only talks to this API. The backend talks to Supabase Auth and Supabase Postgres.

## Local Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor.
3. Copy `backend/.env.example` to `backend/.env` and fill in `DB_URL_TEMPLATE`, `DB_PASSWORD`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY`.
4. Start the API:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
PORT=8000 gunicorn -c gunicorn.conf.py wsgi:app
```

## Docker Compose

From the repo root:

```bash
cp .env.example .env
# Fill the Supabase values in .env first.
docker compose up --build
```

Paste Supabase's **pooler** Postgres URL template into `DB_URL_TEMPLATE` with `[YOUR-PASSWORD]` still in place, then put the raw password in `DB_PASSWORD`. The backend URL-encodes the password before connecting, so special characters are fine. Do not use the Direct connection URL (`db.<project-ref>.supabase.co`) for Docker/local unless your network supports IPv6 or you enabled Supabase's IPv4 add-on.

The frontend runs at `http://localhost:3000` and proxies `/api/*` to the backend container. The backend runs at `http://localhost:8000`.

## Environment Variables

- `DB_URL_TEMPLATE`: Supabase pooler Postgres URL template with `[YOUR-PASSWORD]` still in place. Prefer Session pooler for Docker/local backend.
- `DB_PASSWORD`: Raw Supabase database password. The backend encodes special characters automatically.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key used server-side to call Supabase Auth signup/login endpoints.
- `SECRET_KEY`: Backend signing key for normal OpenSauce API tokens and temporary `/achieve` tokens.
- `PUBLIC_BASE_URL`: Public API URL used in generated `SKILL.md` links.
- `CORS_ALLOWED_ORIGIN`: Frontend origin allowed to call the API.

## Auth Model

Normal user routes require an OpenSauce API token returned by `POST /user` or `POST /login`:

```http
Authorization: Bearer <opensauce-api-token>
```

`POST /user` and `POST /login` proxy Supabase Auth from the backend, then return a backend-signed API token to the client. `/skill` still issues a separate backend-signed temporary JWT scoped to achievement submission. `/achieve` accepts either a normal OpenSauce API token or a temporary achievement token. Temporary achievement tokens cannot access user-only routes.

GitHub login also stays backend-only. Enable the GitHub provider in Supabase Auth, then add the backend callback URL to Supabase Auth redirect URLs:

```text
http://localhost:8000/oauth/github/callback
```

In the GitHub OAuth App itself, use the Supabase provider callback URL shown in **Supabase Auth > Sign In / Providers > GitHub**. It looks like:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

In **Supabase Auth > Sign In / Providers > GitHub**, the GitHub `Client ID` must be the actual Client ID copied from the GitHub OAuth App after registration. Do not put the GitHub app name, such as `OpenSauce`, in this field. If GitHub redirects to a 404 URL with `client_id=OpenSauce`, the Supabase provider is configured with the app name instead of the real Client ID.

For production, set `GITHUB_REDIRECT_URI` to the deployed backend callback and `OAUTH_SUCCESS_REDIRECT` to the deployed frontend `/oauth/callback` route.

## Deployment

Render Free Web Service:

- Production URL: `https://api.opensauce.itdogtics.com`
- Render fallback URL: `https://opensauce-api.onrender.com`
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn -c gunicorn.conf.py wsgi:app`
- Health check path: `/health`

Required Render env vars: `DB_URL_TEMPLATE`, `DB_PASSWORD`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SECRET_KEY`, `PUBLIC_BASE_URL`, and `CORS_ALLOWED_ORIGIN`.

Production URL env vars:

```env
PUBLIC_BASE_URL=https://api.opensauce.itdogtics.com
GITHUB_REDIRECT_URI=https://api.opensauce.itdogtics.com/oauth/github/callback
OAUTH_SUCCESS_REDIRECT=https://opensauce.itdogtics.com/oauth/callback
CORS_ALLOWED_ORIGIN=https://opensauce.itdogtics.com
```

Optional backend tuning env vars: `GUNICORN_WORKERS`, `GUNICORN_THREADS`, `GUNICORN_TIMEOUT`, `GUNICORN_GRACEFUL_TIMEOUT`, `GUNICORN_KEEPALIVE`, and `GUNICORN_LOG_LEVEL`. The defaults use threaded workers so local OAuth/Supabase waits and dropped browser sockets do not monopolize the only request worker.

## GitHub CI

The `Build Test Deploy` workflow runs backend unit tests, frontend build, and backend Docker build on every branch push and pull request. Pushes to `main` deploy production automatically.

For branch production verification, open **Actions > Build Test Deploy > Run workflow**, choose the branch, and set `deploy_frontend` and/or `deploy_backend` to `true`. Backend deployment uses Render's API with `commitId: $GITHUB_SHA`, so a manual branch run deploys the exact branch commit that passed CI. Keep `main` as the known-working rollback path.

Required GitHub Actions secrets for deployment:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
RENDER_API_KEY
RENDER_SERVICE_ID
```

## Tests

```bash
cd backend
pip install -r requirements.txt
python -m pytest
```

Production smoke test both the Render hostname and custom API hostname:

```bash
cd backend
OPENSAUCE_EMAIL=smoke@example.com OPENSAUCE_PASSWORD='...' ./scripts/smoke-production.sh
```

By default it checks:

```text
https://opensauce-api.onrender.com
https://api.opensauce.itdogtics.com
```

Override targets with:

```bash
TARGETS="https://opensauce-api.onrender.com" OPENSAUCE_EMAIL=... OPENSAUCE_PASSWORD=... ./scripts/smoke-production.sh
```
