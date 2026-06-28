@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion

REM -- Check prerequisites --
if not exist .env (
  echo No .env file found. Run setup.bat first.
  pause
  exit /b 1
)

where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Docker is not installed. Install Docker Desktop first.
  pause
  exit /b 1
)

docker info >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Docker is not running. Open Docker Desktop first.
  pause
  exit /b 1
)

REM -- Find available port --
set PORT=8000
:checkport
netstat -an | findstr ":%PORT% " >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  set /a PORT=PORT+1
  if %PORT% GTR 8020 (
    echo ERROR: No available port found (tried 8000-8020).
    pause
    exit /b 1
  )
  goto checkport
)

set HOST_PORT=%PORT%

REM -- Pull pre-built image (fall back to local build) --
echo Pulling latest image...
docker compose -f docker\docker-compose.yml pull
if %ERRORLEVEL% NEQ 0 (
  echo   Building locally (this may take 5-10 minutes the first time)...
  echo   Future starts will be instant.
  docker compose -f docker\docker-compose.yml build
)

echo.
echo Starting YourHonor AI...
docker compose -f docker\docker-compose.yml up -d

echo.
echo ==============================
echo   YourHonor AI is running at
echo   http://localhost:%PORT%
echo ==============================

timeout /t 3 /nobreak >nul
start http://localhost:%PORT%

pause
