$RootPath = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$AndroidPath = Join-Path $RootPath "android"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Workflow Updater - Android Release Build" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

& (Join-Path $RootPath "scripts\sync-android-assets.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& "$env:USERPROFILE\.android\signing\ensure-signing.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location $AndroidPath
try {
    Write-Host "[*] Running Gradle assembleRelease..." -ForegroundColor Yellow
    .\gradlew.bat assembleRelease --no-daemon
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Release build failed." -ForegroundColor Red
        exit $LASTEXITCODE
    }

    $ApkPath = Join-Path $AndroidPath "app\build\outputs\apk\release\app-release.apk"
    if (Test-Path $ApkPath) {
        Write-Host ""
        Write-Host "[OK] Release APK built:" -ForegroundColor Green
        Write-Host "     $ApkPath" -ForegroundColor Green
    } else {
        Write-Host "[X] APK not found at expected path." -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
