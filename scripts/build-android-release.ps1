$RootPath = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$AndroidPath = Join-Path $RootPath "android"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Workflow Updater - Android Release Build" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

& (Join-Path $RootPath "scripts\sync-android-assets.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[*] Generating release notes..." -ForegroundColor Yellow
python (Join-Path $RootPath "scripts\generate-android-release-notes.py") (Join-Path $RootPath "android")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& (Join-Path $RootPath "scripts\ensure-android-signing.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location $AndroidPath
try {
    Write-Host "[*] Running Gradle bundleRelease (Play Store AAB)..." -ForegroundColor Yellow
    .\gradlew.bat bundleRelease --no-daemon
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Release build failed." -ForegroundColor Red
        exit $LASTEXITCODE
    }

    $AabPath = Join-Path $AndroidPath "app\build\outputs\bundle\release\app-release.aab"
    if (Test-Path $AabPath) {
        Write-Host ""
        Write-Host "[OK] Release AAB built (upload this to Play Console):" -ForegroundColor Green
        Write-Host "     $AabPath" -ForegroundColor Green
    } else {
        Write-Host "[X] AAB not found at expected path." -ForegroundColor Red
        exit 1
    }

    Write-Host "[*] Running Gradle assembleRelease (optional APK)..." -ForegroundColor Yellow
    .\gradlew.bat assembleRelease --no-daemon
    if ($LASTEXITCODE -eq 0) {
        $ApkPath = Join-Path $AndroidPath "app\build\outputs\apk\release\app-release.apk"
        if (Test-Path $ApkPath) {
            Write-Host "[OK] Release APK built:" -ForegroundColor Green
            Write-Host "     $ApkPath" -ForegroundColor Green
        }
    }
} finally {
    Pop-Location
}
