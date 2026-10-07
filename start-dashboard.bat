@echo off
setlocal
title Casino Platform - 1-Click Starter Dashboard
cd /d "%~dp0"

echo ======================================================================
echo           CASINO PLAYERS CLUB - 1-CLICK LAUNCHER
echo ======================================================================
echo.

node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul
)

node scripts\launcher.mjs

if errorlevel 1 pause
