# Connect to MongoDB Atlas, seed DB, then start the app.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

$ip = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content.Trim()
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Timetable Scheduler - Atlas setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your public IP: $ip" -ForegroundColor Yellow
Write-Host ""
Write-Host "If seed fails, add this IP in MongoDB Atlas:" -ForegroundColor White
Write-Host "  Network Access -> Add IP Address -> $ip" -ForegroundColor Gray
Write-Host "  (or Allow Access from Anywhere: 0.0.0.0/0 for dev)" -ForegroundColor Gray
Write-Host ""
Write-Host "Opening Atlas Network Access in your browser..." -ForegroundColor Cyan
Start-Process "https://cloud.mongodb.com/v2#/security/network/accessList"

$maxAttempts = 36
$connected = $false

for ($i = 1; $i -le $maxAttempts; $i++) {
  Write-Host "[$i/$maxAttempts] Testing MongoDB connection..." -ForegroundColor DarkGray
  node server/scripts/testAndSeed.js
  if ($LASTEXITCODE -eq 0) {
    $connected = $true
    break
  }
  if ($i -lt $maxAttempts) {
    Write-Host "  Not connected yet. Retry in 5s (add IP in Atlas if you have not)..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds 5
  }
}

if (-not $connected) {
  Write-Host ""
  Write-Host "Could not connect after $($maxAttempts * 5) seconds." -ForegroundColor Red
  Write-Host ('Add IP ' + $ip + ' in Atlas Network Access, then run: npm run setup:db') -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "Starting app (client and server)..." -ForegroundColor Green
npm run dev
