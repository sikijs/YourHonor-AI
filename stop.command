#!/bin/bash

cd "$(dirname "$0")"

RUNNING=$(docker compose -f docker/docker-compose.yml ps -q 2>/dev/null)
if [ -z "$RUNNING" ]; then
  echo "YourHonor AI is not currently running."
  read -n1 -p "Press any key to exit..." key
  exit 0
fi

echo "Stopping YourHonor AI..."
docker compose -f docker/docker-compose.yml down
echo "YourHonor AI stopped."
