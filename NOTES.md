# Notes

Quick reference for managing YourHonor AI.

## How It Works

Think of YourHonor AI like a restaurant:

| Part | Role |
|------|------|
| **Your browser** | You at the table |
| **Frontend (Next.js)** | The waiter + menu — the web pages you see and interact with |
| **Backend (Python/FastAPI)** | The chef — processes your requests, talks to the recipe book and AI expert |
| **Qdrant** | The recipe book — stores pre-written legal case summaries |
| **Docker Desktop** | The kitchen manager — keeps everything running |
| **OpenRouter API Key** | A prepaid card to call an external AI expert |

**The flow:**

1. Open `http://localhost:8000` in your browser
2. The waiter (frontend) loads the menu (UI)
3. You type a question → waiter takes it to the chef (backend)
4. Chef checks the recipe book (Qdrant) for relevant cases
5. Chef may call the AI expert (OpenRouter) if needed
6. Chef hands the response back to the waiter (frontend)
7. Waiter shows it on your screen

Everything runs on your own computer — only the OpenRouter API call leaves your machine.

---

## App Lifecycle (Docker)

Run all docker commands from the `docker/` folder:
```bash
cd ~/YourHonor\ AI/docker
```

| What | Command |
|------|---------|
| Start the app | `docker compose up -d` |
| Stop the app | `docker compose down` |
| Restart (no code change) | `docker compose restart` |
| Rebuild & restart (after code change) | `docker compose up -d --build` |
| View live logs | `docker compose logs -f` |
| Check running containers | `docker ps` |
| See all containers (including stopped) | `docker ps -a` |
| Open the app in browser | http://localhost:8000 |
| Run frontend tests | `cd frontend && npx jest` |

## Docker Images & Disk

| What | Command |
|------|---------|
| List all images | `docker images` |
| Remove an image | `docker rmi <image-name-or-id>` |
| Check disk usage | `docker system df` |
| Clean up unused images/containers | `docker system prune` |

## Git — Update Landing Page

Run from `~/YourHonor\ AI/`:
```bash
git status                # See what changed
git add docs/index.html   # Stage the landing page
git commit -m "message"   # Commit changes
git push                  # Push to GitHub (site auto-updates)
git log --oneline         # See recent commits
```

One-liner for quick updates:
```bash
cd ~/YourHonor\ AI && git add -A && git commit -m "update" && git push
```

## macOS — Unblock Scripts

After downloading the zip, run this to unblock all `.command` files at once:
```bash
xattr -dr com.apple.quarantine 
```
Then drag the `YourHonor-AI-main` folder into Terminal and press Enter.

## Useful Checks

| What | Command |
|------|---------|
| Check if Docker is running | `docker info` |
| See what's using port 8000 | `lsof -i :8000` |
| Free disk space | `df -h` |
| List files in current folder | `ls -la` |
| Open current folder in Finder | `open .` |
| Print working directory | `pwd` |
| Navigate to folder | `cd /path/to/folder` |

## Quick Edits

| What | Command |
|------|---------|
| Open landing page in editor | `open ~/YourHonor\ AI/docs/index.html` |
| Open README in editor | `open ~/YourHonor\ AI/README.md` |
| Open this notes file | `open ~/YourHonor\ AI/NOTES.md` |
