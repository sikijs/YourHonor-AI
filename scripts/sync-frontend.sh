#!/bin/bash
# Sync the built frontend into backend/app/static so it ships inside the
# Docker image (the backend image is built from backend/, which includes
# app/static/). This mirrors what .github/workflows/publish-image.yml does.
#
# Usage: bash scripts/sync-frontend.sh
set -e

cd "$(dirname "$0")/.."

echo "Building frontend..."
(cd frontend && npm run build)

echo "Syncing frontend/out -> backend/app/static..."
rm -rf backend/app/static/
cp -r frontend/out/. backend/app/static/

echo "  [OK] Static frontend synced. Rebuild the Docker image to pick it up:"
echo "  docker compose -f docker/docker-compose.yml build backend"
echo "  docker compose -f docker/docker-compose.yml up -d backend"
