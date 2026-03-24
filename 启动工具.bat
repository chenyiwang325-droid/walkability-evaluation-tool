@echo off
title Walkability Evaluation Tool
cd /d "%~dp0"

echo.
echo ========================================
echo   Walkability Expert Evaluation Tool
echo ========================================
echo.

echo [1/2] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js not found!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Choose LTS version.
    echo.
    pause
    exit /b 1
)

node -v
echo [OK] Node.js found
echo.

echo [2/2] Checking server file...
if not exist "server.js" (
    echo.
    echo [ERROR] server.js not found!
    echo.
    pause
    exit /b 1
)
echo [OK] server.js found
echo.

echo ========================================
echo   Starting server...
echo ========================================
echo.
echo   URL: http://localhost:3000
echo   Press Ctrl+C to stop
echo.
echo ========================================
echo.

node server.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server failed to start
    echo Error code: %errorlevel%
    echo.
    pause
)
