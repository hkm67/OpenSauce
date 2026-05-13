# OpenSauce

OpenSauce is organized as a monorepo with a Flask backend and Vite/React frontend.

## Cloud Deployment State

- Database and user management: Supabase Postgres + Supabase Auth, proxied through the backend.
- Backend deployment target: Render Free Web Service from `backend/`.
- Frontend deployment target: Vercel with project root `frontend/`.
- CI/CD: `.github/workflows/deploy.yml` runs backend unit tests, frontend build, and backend Docker build on every branch push and pull request. Pushes to `main` deploy production automatically. Branches can also be manually promoted to production with the workflow's `workflow_dispatch` inputs after checks pass.

## Production Deployment Map

- Frontend production URL: `https://opensauce.itdogtics.com`
- Frontend Vercel fallback URL: `https://open-sauce-theta.vercel.app`
- Vercel project: `open-sauce`
- Backend production URL: `https://api.opensauce.itdogtics.com`
- Backend Render fallback URL: `https://opensauce-api.onrender.com`
- Render service: `opensauce-api`
- Supabase project URL: `https://wyshohsvlmzqhtxxkcre.supabase.co`

Production runtime values:

```env
VITE_API_BASE_URL=https://api.opensauce.itdogtics.com
PUBLIC_BASE_URL=https://api.opensauce.itdogtics.com
GITHUB_REDIRECT_URI=https://api.opensauce.itdogtics.com/oauth/github/callback
OAUTH_SUCCESS_REDIRECT=https://opensauce.itdogtics.com/oauth/callback
CORS_ALLOWED_ORIGIN=https://opensauce.itdogtics.com
```

## Setup Order

1. Create a Supabase project and run `supabase/migrations/001_initial_schema.sql`.
2. Enable Supabase Email/Password Auth. For GitHub login, enable the GitHub provider in Supabase Auth, add `http://localhost:8000/oauth/github/callback` to allowed redirect URLs for local Docker, and use Supabase's GitHub provider callback URL in the GitHub OAuth App. In Supabase's GitHub provider settings, paste the real GitHub OAuth App Client ID and Client Secret; the Client ID is not the app name.
3. Configure Render with backend env vars from `backend/.env.example`.
4. Configure Vercel with `VITE_API_BASE_URL`; the browser does not need Supabase credentials.
5. Add GitHub repository secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RENDER_API_KEY`, and `RENDER_SERVICE_ID`.

## Run Locally With Docker

Docker Compose uses a local Postgres container by default, so local full-stack testing does not touch the cloud Supabase database:

```bash
cp .env.example .env
docker compose up --build
```

You can also run the example file directly without copying it:

```bash
docker compose --env-file .env.example up --build
```

The default root `.env.example` points `DB_URL_TEMPLATE` at the Compose `db` service and enables `LOCAL_AUTH_ENABLED=true`, so `POST /user` and `POST /login` work against local tables. The Compose Postgres container uses the matching local credentials from that URL: database/user/password are all `opensauce`. To test against Supabase instead, use a separate override compose file or run the backend outside this local Compose stack with the Supabase pooler `DB_URL_TEMPLATE`, `DB_PASSWORD`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `LOCAL_AUTH_ENABLED=false`.

Use `http://localhost:3000` for the app and `http://localhost:8000/health` for the API. For Docker/local, keep `VITE_API_BASE_URL=http://localhost:8000` so browser redirects for GitHub OAuth stay on the backend origin.

Useful local checks:

```bash
cd backend
python3 -m pytest -q

cd ../frontend
npm run build
```

## Agent Workflow

When an agent works on this repository, prefer this flow:

1. Run locally with Docker Compose:

   ```bash
   docker compose --env-file .env.example up --build
   ```

2. Validate the backend and frontend before proposing a change:

   ```bash
   cd backend && python3 -m pytest -q
   cd ../frontend && npm run build
   ```

3. Commit the change on a branch and open a GitHub pull request / merge request.

4. Let CI handle verification and deployment. The workflow in `.github/workflows/deploy.yml` runs backend unit tests, frontend build, and backend Docker build on branch pushes and pull requests.

5. Production deployment is handled by CI:
   - pushes to `main` deploy production automatically after checks pass;
   - manual branch promotion is available from GitHub Actions via `workflow_dispatch` with `deploy_frontend` and/or `deploy_backend` set to `true`.

Agents should not point local Docker at production Supabase unless explicitly asked. The default `.env.example` is intentionally safe for local full-stack testing.

See `backend/README.md` for backend runtime details.
