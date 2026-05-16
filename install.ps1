@echo off
REM AfterLink Communication Protocol - Windows Installation Script
REM Run this script to set up the AfterLink development environment

echo ============================================
echo  AfterLink Communication Protocol
echo  Installation Script (Windows)
echo ============================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js 20+ from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node --version
echo.

REM Check if pnpm is installed
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] pnpm not found. Installing pnpm...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install pnpm.
        pause
        exit /b 1
    )
)

echo [OK] pnpm found:
pnpm --version
echo.

REM Install dependencies
echo [INFO] Installing dependencies...
pnpm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo [OK] Dependencies installed successfully.
echo.

REM Run tests
echo [INFO] Running tests...
cd packages\core
call npx vitest run
cd ..\..
echo.

echo ============================================
echo  Installation Complete!
echo ============================================
echo.
echo  Quick Start:
echo    1. Run demo showcase:
echo       cd examples\demo-runner
echo       node index.js
echo.
echo    2. Run chat demo:
echo       cd examples\demo-chat
echo       node server.js    (Terminal 1)
echo       node client.js    (Terminal 2)
echo.
echo    3. Run stock dashboard:
echo       cd examples\demo-dashboard
echo       node server.js    (Terminal 1)
echo       node client.js    (Terminal 2)
echo.
echo    4. Run microservice demo:
echo       cd examples\demo-microservice
echo       node server.js    (Terminal 1)
echo       node client.js    (Terminal 2)
echo.
echo  Documentation: See README.md
echo  GitHub: https://github.com/AJAYMYTH/AfterLink
echo ============================================
echo.
pause
