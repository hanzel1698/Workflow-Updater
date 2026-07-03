# Creates a Play upload keystore under %USERPROFILE%\.android\signing\ if missing.
# The keystore and signing.properties are local-only — never commit them.

$SigningDir = Join-Path $env:USERPROFILE ".android\signing"
$KeystorePath = Join-Path $SigningDir "upload-keystore.jks"
$PropsPath = Join-Path $SigningDir "signing.properties"

New-Item -ItemType Directory -Force -Path $SigningDir | Out-Null

if ((Test-Path $KeystorePath) -and (Test-Path $PropsPath)) {
    Write-Host "[OK] Upload keystore already exists: $KeystorePath" -ForegroundColor Green
    exit 0
}

$keyAlias = "workflowupdater"
$storePassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
$keyPassword = $storePassword

Write-Host "[*] Generating upload keystore at $KeystorePath ..." -ForegroundColor Yellow

$dname = "CN=RDO KKD Workflow, OU=Design Office, O=RDO KKD, L=Kozhikode, ST=Kerala, C=IN"
$keytoolArgs = @(
    "-genkeypair", "-v",
    "-keystore", $KeystorePath,
    "-alias", $keyAlias,
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-storepass", $storePassword,
    "-keypass", $keyPassword,
    "-dname", $dname
)

& keytool @keytoolArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] keytool failed. Install JDK and ensure keytool is on PATH." -ForegroundColor Red
    exit 1
}

@"
storePassword=$storePassword
keyAlias=$keyAlias
keyPassword=$keyPassword
"@ | Set-Content -Path $PropsPath -Encoding UTF8

Write-Host ""
Write-Host "[OK] Upload keystore created." -ForegroundColor Green
Write-Host "     Keystore : $KeystorePath" -ForegroundColor Green
Write-Host "     Alias    : $keyAlias" -ForegroundColor Green
Write-Host "     Passwords: saved in $PropsPath" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Back up the keystore and signing.properties securely." -ForegroundColor Yellow
Write-Host "           You need them for every future Play Store update." -ForegroundColor Yellow
