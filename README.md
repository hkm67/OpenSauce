# OpenSauce

OpenSauce is organized as a monorepo with a Flask backend and Vite/React frontend.

## Cloud Deployment State

- Database and user management: Supabase Postgres + Supabase Auth, proxied through the backend.
- Backend deployment target: Render Free Web Service from `backend/`.
- Frontend deployment target: Vercel from `frontend/`.
- CI/CD: `.github/workflows/deploy.yml` runs backend unit tests, frontend build, and backend Docker build on every branch push and pull request. Pushes to `main` deploy automatically. Branches can also be deployed manually with the workflow's `workflow_dispatch` inputs after checks pass.

## Setup Order

1. Create a Supabase project and run `supabase/migrations/001_initial_schema.sql`.
2. Enable Supabase Email/Password Auth. For GitHub login, enable the GitHub provider in Supabase Auth, add `http://localhost:8000/oauth/github/callback` to allowed redirect URLs for local Docker, and use Supabase's GitHub provider callback URL in the GitHub OAuth App. In Supabase's GitHub provider settings, paste the real GitHub OAuth App Client ID and Client Secret; the Client ID is not the app name.
3. Configure Render with backend env vars from `backend/.env.example`.
4. Configure Vercel with `VITE_API_BASE_URL`; the browser does not need Supabase credentials.
5. Add GitHub repository secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `RENDER_DEPLOY_HOOK_URL`.

## Run Locally With Docker

Docker Compose now uses Supabase as the database, so it needs a filled root `.env` before the API can boot:

```bash
cp .env.example .env
# Fill DB_URL_TEMPLATE, DB_PASSWORD, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SECRET_KEY
docker compose up --build
```

Paste Supabase's **pooler** Postgres URL template into `DB_URL_TEMPLATE` with `[YOUR-PASSWORD]` still in place, then put the raw password in `DB_PASSWORD`. The backend URL-encodes the password before connecting, so special characters are fine. Do not use the Direct connection URL (`db.<project-ref>.supabase.co`) for Docker/local unless your network supports IPv6 or you enabled Supabase's IPv4 add-on.

Use `http://localhost:3000` for the app and `http://localhost:8000/health` for the API. For Docker/local, keep `VITE_API_BASE_URL=http://localhost:8000` so browser redirects for GitHub OAuth stay on the backend origin.

See `backend/README.md` for backend runtime details.
