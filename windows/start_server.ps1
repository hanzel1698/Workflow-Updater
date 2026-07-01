# start_server.ps1 - Workflow Updater Local Server Launcher
# Spin up a lightweight local HTTP server and launch the browser to bypass local file scheme CORS restrictions.

$HostPort = 8000
$Url = "http://localhost:$HostPort"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "      Workflow Updater Local Server" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Check for Python
if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host "[√] Python detected. Starting server on $Url ..." -ForegroundColor Green
    Start-Process "$Url"
    python -m http.server $HostPort
}
# Check for Node / NPX
elif (Get-Command npx -ErrorAction SilentlyContinue) {
    Write-Host "[√] Node/NPM detected. Starting http-server on $Url ..." -ForegroundColor Green
    Start-Process "$Url"
    npx http-server -p $HostPort -c-1
}
else {
    Write-Host "[X] Error: No Python or Node.js runtime environment found!" -ForegroundColor Red
    Write-Host "Please install Python (https://www.python.org) or Node.js (https://nodejs.org) to run the server on PC." -ForegroundColor Yellow
    Write-Host "Alternatively, you can open index.html directly but live sheet integration will be blocked by the browser's local file CORS security policy." -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
}
