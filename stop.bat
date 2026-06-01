@echo off
cd /d "%~dp0"

echo Stopping YourHonor AI...
docker compose -f docker\docker-compose.yml down

echo YourHonor AI stopped.
pause
