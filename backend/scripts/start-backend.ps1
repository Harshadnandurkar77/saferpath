$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env")) {
    Write-Error "Missing backend/.env. Copy .env.example and set DATABASE_URL to PostgreSQL with PostGIS enabled."
}
if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Error "Missing backend/.venv. Run: py -m venv .venv; .\.venv\Scripts\python -m pip install -e '.[dev]'"
}

& .\.venv\Scripts\python.exe -m alembic upgrade head
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
