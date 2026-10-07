@echo off
title Casino Platform - Server
cd /d "%~dp0"

echo ======================================================================
echo           CASINO PLAYERS CLUB - DIRECT LAUNCHER
echo ======================================================================
echo.

node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH!
    pause
    exit /b 1
)

echo [*] Opening browser in 3 seconds...
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo [*] Starting Next.js Server on http://localhost:3000 ...
echo.
npm run dev

pause
