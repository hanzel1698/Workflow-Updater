# Copies the canonical Windows/web dashboard into the Android app assets folder.
$RootPath = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Source = Join-Path $RootPath "windows"
$Target = Join-Path $RootPath "android\app\src\main\assets"

$Files = @("app.js", "index.html", "config.js", "style.css")

if (-not (Test-Path $Source)) {
    Write-Error "Windows source folder not found: $Source"
    exit 1
}

New-Item -ItemType Directory -Force -Path $Target | Out-Null

foreach ($File in $Files) {
    $SrcFile = Join-Path $Source $File
    if (-not (Test-Path $SrcFile)) {
        Write-Error "Missing source file: $SrcFile"
        exit 1
    }
    Copy-Item -Path $SrcFile -Destination (Join-Path $Target $File) -Force
    Write-Host "[OK] Synced $File"
}

Write-Host "Android assets synced from windows/"
