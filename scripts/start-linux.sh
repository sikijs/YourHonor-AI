#!/bin/bash
set -e

cd "$(dirname "$0")/.."
docker compose -f docker/docker-compose.yml up --build -d
echo "YourHonor AI started at http://localhost:8000"