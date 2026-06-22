#!/bin/bash
set -e

cd "$(dirname "$0")/.."

if [ ! -f ".env" ]; then
  echo "No .env file found. Run: bash scripts/setup-linux.sh"
  exit 1
fi

# Find available port
PORT=8000
while ss -tln "sport = :$PORT" 2>/dev/null | grep -q ":$PORT"; do
  PORT=$((PORT + 1))
  if [ $PORT -gt 8020 ]; then
    echo "ERROR: No available port found (tried 8000-8020)."
    exit 1
  fi
done

export HOST_PORT=$PORT

# Pull pre-built image (fall back to local build)
echo "Pulling latest image..."
if docker compose -f docker/docker-compose.yml pull 2>/dev/null; then
  echo "  [OK] Pre-built image downloaded."
else
  echo "  Building locally (this may take 5-10 minutes the first time)..."
  echo "  Future starts will be instant."
  docker compose -f docker/docker-compose.yml build
fi

echo ""
echo "Starting YourHonor AI..."
docker compose -f docker/docker-compose.yml up -d

echo ""
echo "YourHonor AI is running at http://localhost:$PORT"
