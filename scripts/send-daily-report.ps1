# Trigger daily PDF report (local or production API).
# Requires CRON_SECRET or EMAIL_INTERNAL_SECRET in .env

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
    }
  }
}

$base = if ($env:NEXT_PUBLIC_API_URL) { $env:NEXT_PUBLIC_API_URL.TrimEnd('/') } else { "http://localhost:3000" }
$secret = if ($env:CRON_SECRET) { $env:CRON_SECRET } else { $env:EMAIL_INTERNAL_SECRET }
if (-not $secret) {
  Write-Error "Set CRON_SECRET or EMAIL_INTERNAL_SECRET in .env"
}

$url = "$base/api/v1/cron/daily-report"
Write-Host "POST $url"
Invoke-RestMethod -Uri $url -Method Get -Headers @{ Authorization = "Bearer $secret" }
