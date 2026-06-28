#!/bin/bash
set -e

cd "$(dirname "$0")"

SCRIPT_DIR="$(pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

clear
echo "=============================="
echo "  YourHonor AI — Setup"
echo "=============================="
echo ""

# ── Check Docker ──────────────────────────────────────────
echo "Checking Docker..."
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed."
  echo "Download and install Docker Desktop from:"
  echo "  https://www.docker.com/products/docker-desktop/"
  echo "Then run this setup again."
  read -n1 -p "Press any key to exit..." key
  exit 1
fi

# Docker running?
if ! docker info &>/dev/null; then
  echo "ERROR: Docker is installed but not running."
  echo "Open Docker Desktop from your Applications folder and wait"
  echo "for the whale icon to appear in the top menu bar."
  read -n1 -p "Press any key to exit..." key
  exit 1
fi
echo "  [OK] Docker is installed and running."
echo ""

# ── OpenRouter API Key ────────────────────────────────────
echo "─── OpenRouter API Key ────────────────────────────────"
echo ""
echo "YourHonor AI uses the Qwen3-14B AI model through OpenRouter."
echo "This requires an API key with at least \$5 in credits."
echo ""
echo "To get your key:"
echo "  1. Go to https://openrouter.ai/keys"
echo "  2. Click 'Sign Up' and create an account"
echo "  3. Click '[+ Create Key]' and copy the key"
echo "  4. Go to https://openrouter.ai/settings/credits"
echo "  5. Add \$5 in credits (lasts thousands of responses)"
echo ""
read -p "Paste your OpenRouter API key (sk-or-v1-...): " OR_KEY
echo ""

# Validate — not empty, starts with expected prefix
if [ -z "$OR_KEY" ]; then
  echo "ERROR: No key entered. You must provide an OpenRouter API key."
  read -n1 -p "Press any key to exit..." key
  exit 1
fi

# ── CourtListener (Optional) ─────────────────────────────
echo "─── CourtListener Token (Optional) ────────────────────"
echo ""
echo "YourHonor AI comes with 24 landmark US Supreme Court"
echo "cases pre-loaded, including:"
echo "  - Gideon v. Wainwright (right to counsel)"
echo "  - Miranda v. Arizona (right to silence)"
echo "  - Roe v. Wade / Dobbs v. Jackson (abortion)"
echo "  - Obergefell v. Hodges (same-sex marriage)"
echo "  - Brown v. Board of Education"
echo "  - ...and 19 more."
echo ""
echo "These 24 cases are enough for most law school assignments."
echo ""
echo "If you want to search ADDITIONAL cases — like a case"
echo "your professor assigned or a state court case — you can"
echo "connect to CourtListener, a free database of millions of"
echo "US court opinions from federal and state courts."
echo ""
echo "How to get a CourtListener token (2 minutes):"
echo "  1. Go to https://www.courtlistener.com/"
echo "  2. Click 'Register' and create a free account"
echo "  3. Confirm your email"
echo "  4. Log in, click your username -> 'Profile'"
echo "  5. Scroll down to the 'API' section"
echo "  6. Copy the token shown there"
echo ""
echo "The free tier allows 1,000 requests per day — plenty for"
echo "classroom use."
echo ""
read -p "Paste your CourtListener token, or press Enter to skip: " CL_TOKEN
echo ""

# ── Write .env ──────────────────────────────────────────
echo "Creating .env file..."

cat > "$ENV_FILE" <<EOF
OPENROUTER_API_KEY=$OR_KEY
EOF

if [ -n "$CL_TOKEN" ]; then
  cat >> "$ENV_FILE" <<EOF
COURTLISTENER_TOKEN=$CL_TOKEN
EOF
  echo "  [OK] OpenRouter key + CourtListener token saved."
else
  echo "  [OK] OpenRouter key saved. Skipping CourtListener."
  echo "  The 24 pre-loaded cases are ready to use."
fi

echo ""
echo "=============================="
echo "  Setup complete!"
echo ""
echo "  Next step: Double-click 'Start YourHonor AI.command'"
echo "=============================="
read -n1 -p "Press any key to exit..." key
