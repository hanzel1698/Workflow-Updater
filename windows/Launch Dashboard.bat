@echo off
title Workflow Updater Launcher
cd /d "%~dp0windows"
echo ==============================================
echo       Workflow Updater Auto-Launcher
echo ==============================================
echo.
powershell.exe -ExecutionPolicy Bypass -File "%~dp0windows\start_server.ps1"
