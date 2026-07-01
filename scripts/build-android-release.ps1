$RootPath = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$AndroidPath = Join-Path $RootPath "android"
$KeystorePath = Join-Path $AndroidPath "workflow-updater-release.keystore"
$KeystorePropsPath = Join-Path $AndroidPath "keystore.properties"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Workflow Updater - Android Release Build" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

& (Join-Path $RootPath "scripts\sync-android-assets.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path $KeystorePath)) {
    Write-Host "[*] Creating release keystore..." -ForegroundColor Yellow
    $DName = "CN=Workflow Updater, OU=RDO KKD, O=PWD, L=Kozhikode, ST=Kerala, C=IN"
    keytool -genkeypair -v `
        -keystore $KeystorePath `
        -alias workflowupdater `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -storepass "WorkflowUpdater2026" `
        -keypass "WorkflowUpdater2026" `
        -dname $DName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Failed to create keystore." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

if (-not (Test-Path $KeystorePropsPath)) {
    @"
storeFile=workflow-updater-release.keystore
storePassword=WorkflowUpdater2026
keyAlias=workflowupdater
keyPassword=WorkflowUpdater2026
"@ | Set-Content -Path $KeystorePropsPath -Encoding ASCII
    Write-Host "[*] Created android/keystore.properties" -ForegroundColor Yellow
}

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
