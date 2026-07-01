# build_exe.ps1 - Standalone Executable Packaging Compiler
# Packages all HTML/CSS/JS files and server code into a single, highly portable Windows executable.

$WindowsPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
Set-Location $WindowsPath

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "     Standalone Executable EXE Compiler" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Install/Verify PyInstaller
# We check if PyInstaller can be imported or run via Python
$PyInstallerCheck = python -c "import PyInstaller" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[*] PyInstaller not detected. Installing PyInstaller via pip..." -ForegroundColor Yellow
    pip install pyinstaller
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Error: Failed to install PyInstaller!" -ForegroundColor Red
        Exit $LASTEXITCODE
    }
}
Write-Host "[√] PyInstaller is ready." -ForegroundColor Green

# 2. Package App using PyInstaller
Write-Host "[*] Compiling app_runner.py and web assets into a single EXE..." -ForegroundColor Yellow

# On Windows, PyInstaller --add-data syntax is "source;destination"
python -m PyInstaller --onefile `
            --add-data "index.html;." `
            --add-data "style.css;." `
            --add-data "app.js;." `
            --add-data "config.js;." `
            --name "WorkflowUpdater" `
            --clean `
            app_runner.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Error: Compilation failed!" -ForegroundColor Red
    Exit $LASTEXITCODE
}

# 3. Clean up build directories and move EXE to root folder
if (Test-Path "dist/WorkflowUpdater.exe") {
    # Move EXE
    Move-Item -Path "dist/WorkflowUpdater.exe" -Destination "./WorkflowUpdater.exe" -Force
    
    # Clean temporary build files
    Write-Host "[*] Cleaning build artifacts..." -ForegroundColor Yellow
    Remove-Item -Path "build" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "WorkflowUpdater.spec" -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host " [√] Standalone EXE compiled successfully!" -ForegroundColor Green
    Write-Host " File created: ./WorkflowUpdater.exe" -ForegroundColor Green
    Write-Host " Size: Portable, single executable." -ForegroundColor Green
    Write-Host " You can now copy WorkflowUpdater.exe to any PC!" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Green
} else {
    Write-Host "[X] Error: Could not locate built executable in 'dist/' directory!" -ForegroundColor Red
}
