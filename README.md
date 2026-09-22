# SaferPath

SaferPath contains one canonical React application and a FastAPI backend:

- `frontend/` is the canonical React/Vite frontend.
- `backend/` contains the FastAPI, SQLAlchemy, PostgreSQL/PostGIS application.
- `doc/` and `docs/` contain project documentation.

## Local Development — No Docker Required

Docker is optional. SaferPath runs directly with Python, Node, and any PostgreSQL database with the PostGIS extension enabled (for example a compatible Neon project, another managed Postgres provider, or a local Postgres/PostGIS installation).

### Backend (Windows, no Docker)

Create `backend/.env` from `backend/.env.example`, set `DATABASE_URL` to a real Postgres/PostGIS connection string, then run:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
Copy-Item .env.example .env
# edit .env: DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/DATABASE?sslmode=require
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The database account must be permitted to enable PostGIS, or PostGIS must already be enabled by the provider. No Redis, Mailhog, WSL, or Docker service is required for the development defaults.

### Docker database (optional)

With Docker available, run `docker compose -f backend/docker-compose.yml up -d`; retain the default backend `.env.example` database URL and then run the same direct `python -m alembic` and `python -m uvicorn` commands above. Compose supplies only PostgreSQL/PostGIS; the application process remains local.

## Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Copy `frontend/.env.example` to `frontend/.env`. Set `VITE_API_URL=http://127.0.0.1:8000/v1` when Vite and FastAPI use separate origins; leave `VITE_MAP_STYLE_URL` blank to use the built-in map fallback. Build and lint with `npm run build` and `npm run lint`.

## Backend

See `backend/README.md` for backend setup, Docker, database, and test commands.
