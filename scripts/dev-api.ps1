$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:PYTHONPATH = "server"
# Use venv python -m uvicorn so reload workers don't spawn system Python (wrong app package / stale routes).
& ".\.venv\Scripts\python.exe" -m uvicorn app.main:app `
  --reload `
  --reload-dir server `
  --reload-delay 2 `
  --host 127.0.0.1 `
  --port 8000
