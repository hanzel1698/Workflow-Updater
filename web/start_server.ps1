# start_server.ps1 - RDO KKD Works web app launcher
# Serves web/ over HTTP so ES modules, the service worker and the live sheet fetch all work.
# (Opening index.html straight off disk is blocked by the browser's file:// security policy.)

$HostPort = 8080
$Url = "http://localhost:$HostPort"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "          RDO KKD Works - Web App" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host "[OK] Python detected. Serving $Url ..." -ForegroundColor Green
    Start-Process $Url
    python -m http.server $HostPort
}
elseif (Get-Command npx -ErrorAction SilentlyContinue) {
    Write-Host "[OK] Node detected. Serving $Url ..." -ForegroundColor Green
    Start-Process $Url
    npx http-server -p $HostPort -c-1
}
else {
    Write-Host "[X] No Python or Node.js runtime found." -ForegroundColor Red
    Write-Host "Install Python (https://www.python.org) or Node.js (https://nodejs.org) to run the web app locally." -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
}
