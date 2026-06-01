#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Stopping YourHonor AI..."
docker compose -f docker/docker-compose.yml down

echo "YourHonor AI stopped."
