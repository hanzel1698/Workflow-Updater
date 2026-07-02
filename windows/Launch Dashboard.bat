@echo off
title Workflow Updater Launcher
cd /d "%~dp0"
echo ==============================================
echo       Workflow Updater Auto-Launcher
echo ==============================================
echo.
powershell.exe -ExecutionPolicy Bypass -File "%~dp0start_server.ps1"
