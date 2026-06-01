@echo off
cd /d "%~dp0"

echo Starting YourHonor AI...
docker compose -f docker\docker-compose.yml up --build -d

echo Opening browser...
timeout /t 3 /nobreak >nul
start http://localhost:8000

echo YourHonor AI is running at http://localhost:8000
pause
