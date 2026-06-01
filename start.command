#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Starting YourHonor AI..."
docker compose -f docker/docker-compose.yml up --build -d

echo "Opening browser..."
sleep 3
open http://localhost:8000

echo "YourHonor AI is running at http://localhost:8000"
