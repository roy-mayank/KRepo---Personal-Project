# KRepo — Run & Deploy

## Deploy online (Railway)

Recommended stack: **3 Railway services** in one project — Postgres with pgvector, FastAPI backend, Vite frontend. No local Docker required.

### 1. Create a Railway project

1. Sign in at [railway.com](https://railway.com).
2. **New Project** → add these services:

| Service | How to add | Root directory |
|---------|------------|----------------|
| **Postgres + pgvector** | **+ New** → **Database** → choose **Postgres with pgvector** template | — |
| **Backend** | **+ New** → **GitHub Repo** → select this repo | `backend` |
| **Frontend** | **+ New** → same repo again (second service) | `frontend` |

Each service reads its own `railway.toml` (`backend/railway.toml`, `frontend/railway.toml`).

### 2. Configure the database

Railway injects `DATABASE_URL` on the Postgres service. On the **backend** service, add:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REQUIRE_PGVECTOR=true
```

(`Postgres` is the default service name — adjust if you renamed it.)

The backend runs `CREATE EXTENSION IF NOT EXISTS vector` and creates tables on startup.

### 3. Configure the backend

Copy values from your repo-root `.env` into the Railway **backend** service variables. Minimum:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REQUIRE_PGVECTOR=true
ANTHROPIC_API_KEY=...
FIREBASE_SERVICE_ACCOUNT=...          # base64-encoded service account JSON
CREDENTIALS_ENCRYPTION_KEY=...        # Fernet key
CORS_ORIGINS=https://YOUR-FRONTEND.up.railway.app,http://localhost:5173
```

After the backend deploys, note its public URL (e.g. `https://krepo-backend.up.railway.app`). Set OAuth redirect URIs to that host:

```env
NOTION_REDIRECT_URI=https://YOUR-BACKEND.up.railway.app/integrations/notion/callback
GOOGLE_REDIRECT_URI=https://YOUR-BACKEND.up.railway.app/integrations/google_drive/callback
```

Also update redirect URIs in the Notion and Google Cloud OAuth consoles.

Add any other integration keys from `backend/.env.example` as needed.

Verify: open `https://YOUR-BACKEND.up.railway.app/health` → `{"status":"ok"}`.

### 4. Configure the frontend

On the **frontend** service, set **before the first build** (Vite bakes env vars at build time):

```env
VITE_API_URL=https://YOUR-BACKEND.up.railway.app
```

Redeploy the frontend after changing `VITE_API_URL`.

### 5. Firebase authorized domains

In [Firebase Console](https://console.firebase.google.com) → your project → **Authentication** → **Settings** → **Authorized domains**, add your Railway frontend hostname (e.g. `your-frontend.up.railway.app`).

### 6. Deploy

Railway auto-deploys on git push if GitHub is connected. Or deploy from the dashboard / CLI:

```powershell
# Install CLI (one time)
npm install -g @railway/cli

# Login (interactive — opens browser)
railway login

# Link and deploy backend
cd backend
railway link
railway up

# Deploy frontend
cd ..\frontend
railway link    # select the frontend service in the same project
railway up
```

### Environment variable checklist

| Variable | Service | Notes |
|----------|---------|-------|
| `DATABASE_URL` | Backend | `${{Postgres.DATABASE_URL}}` |
| `REQUIRE_PGVECTOR` | Backend | `true` |
| `ANTHROPIC_API_KEY` | Backend | Required for chat |
| `FIREBASE_SERVICE_ACCOUNT` | Backend | Base64 service account JSON |
| `CREDENTIALS_ENCRYPTION_KEY` | Backend | Fernet key for OAuth tokens |
| `CORS_ORIGINS` | Backend | Frontend Railway URL + localhost |
| `NOTION_REDIRECT_URI` | Backend | Backend URL + `/integrations/notion/callback` |
| `GOOGLE_REDIRECT_URI` | Backend | Backend URL + `/integrations/google_drive/callback` |
| `VITE_API_URL` | Frontend | Backend public URL (set before build) |

See `backend/.env.example` for the full list of optional integration keys.

---

## Local development (optional)

If you want to run against a local database instead of Railway:

**Terminal 1 — backend** (from `backend/`):

```powershell
uv run uvicorn main:app --reload
```

**Terminal 2 — frontend** (from `frontend/`):

```powershell
npm run dev
```

Open http://localhost:5173 — API at http://127.0.0.1:8000.

Copy secrets into repo-root `.env` (see `backend/.env.example`). Minimum:

```env
DATABASE_URL=postgresql+asyncpg://postgres:password@127.0.0.1:5432/krepo
REQUIRE_PGVECTOR=true
ANTHROPIC_API_KEY=...
FIREBASE_SERVICE_ACCOUNT=...
```

Frontend: `frontend/.env` with `VITE_API_URL=http://127.0.0.1:8000`.

**Database options:** Railway-hosted Postgres (point `DATABASE_URL` at `DATABASE_PUBLIC_URL` from the Railway Postgres service), or local Postgres with pgvector. `docker compose up -d` from repo root is one local option if you have Docker.

**Without pgvector:** `REQUIRE_PGVECTOR=false` lets the API boot for auth smoke tests only — chat and RAG will not work.

**OAuth (local):** redirect URIs must hit the backend, not Vite:

```env
NOTION_REDIRECT_URI=http://127.0.0.1:8000/integrations/notion/callback
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/integrations/google_drive/callback
```
