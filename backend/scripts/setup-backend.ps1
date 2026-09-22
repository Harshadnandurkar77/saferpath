$ErrorActionPreference = "Stop"

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    Write-Error "Python launcher 'py' was not found. Install Python 3.12–3.14 and retry."
}
py -m venv .venv
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -e ".[dev]"
if (-not (Test-Path ".env")) {
    Copy-Item .env.example .env
    Write-Host "Created .env. Set DATABASE_URL to a PostgreSQL/PostGIS database before starting the API."
}
