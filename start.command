#!/bin/bash
set -e

cd "$(dirname "$0")"

# ── Check prerequisites ────────────────────────────────
if [ ! -f ".env" ]; then
  echo "No .env file found. Run setup.command first."
  read -n1 -p "Press any key to exit..." key
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "Docker is not installed. Install Docker Desktop first."
  read -n1 -p "Press any key to exit..." key
  exit 1
fi

if ! docker info &>/dev/null; then
  echo "Docker is not running. Open Docker Desktop first."
  read -n1 -p "Press any key to exit..." key
  exit 1
fi

# ── Find available port ────────────────────────────────
PORT=8000
while lsof -i :$PORT &>/dev/null 2>&1; do
  PORT=$((PORT + 1))
  if [ $PORT -gt 8020 ]; then
    echo "ERROR: No available port found (tried 8000-8020)."
    read -n1 -p "Press any key to exit..." key
    exit 1
  fi
done

export HOST_PORT=$PORT

# ── Pull pre-built image (fall back to local build) ────
echo "Pulling latest image..."
if docker compose -f docker/docker-compose.yml pull 2>/dev/null; then
  echo "  [OK] Pre-built image downloaded."
else
  echo "  Building locally (this may take 5-10 minutes the first time)..."
  echo "  Future starts will be instant."
  docker compose -f docker/docker-compose.yml build 2>&1
fi

echo ""
echo "Starting YourHonor AI..."
docker compose -f docker/docker-compose.yml up -d

echo ""
echo "=============================="
echo "  YourHonor AI is running at"
echo "  http://localhost:$PORT"
echo "=============================="

# Open browser
if command -v open &>/dev/null; then
  sleep 2
  open "http://localhost:$PORT"
fi

read -n1 -p "Press any key to exit..." key
