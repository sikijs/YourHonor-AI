# Notes

> **Version 1.2.0**

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

## Live Editing (No Docker Rebuild)

Edit without rebuilding the Docker image. Frontend hot reloads on save, backend auto-restarts.

**1. Stop the Docker backend** (frees up port 8000):
```bash
docker stop docker-backend-1
```

**2. Start the local backend** (from `backend/`):
```bash
cd ~/YourHonor\ AI/backend
.venv/bin/uvicorn app.main:app --reload --port 8000
```

**3. Start the frontend dev server** (from `frontend/` — separate terminal):
```bash
cd ~/YourHonor\ AI/frontend
npm run dev
```

**4. Open** http://localhost:3000 in your browser.

**When done — put Docker backend back:**
```bash
kill $(lsof -ti :3000)   # stop frontend dev server
kill $(lsof -ti :8000)   # stop local backend
docker start docker-backend-1  # restart Docker backend
```

---

## App Lifecycle (Docker)

Run all docker commands from the `docker/` folder:
```bash
cd ~/YourHonor\ AI/docker
```

| What | Command |
|------|---------|
| Pull latest image & start | `docker compose pull && docker compose up -d` |
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

---

## Releasing a New Version

Run all commands from `~/YourHonor AI/` unless noted.

**1. Make your code changes and commit them**
```bash
git add <files>
git commit -m "your message"
git push
```

**2. Rebuild the frontend**
```bash
cd frontend && npm run build
cp -r out/. ../backend/app/static/
cd ..
```

**3. Commit the rebuilt frontend**
```bash
git add backend/app/static/
git commit -m "Rebuild frontend for vX.Y.Z"
git push
```

**4. Build the Docker image** (replace `vX.Y.Z` with the new version)
```bash
docker build -f docker/Dockerfile.backend \
  -t ghcr.io/sikijs/yourhonor-ai/backend:vX.Y.Z \
  -t ghcr.io/sikijs/yourhonor-ai/backend:latest .
```

**5. Push the image to ghcr.io**
```bash
docker push ghcr.io/sikijs/yourhonor-ai/backend:vX.Y.Z
docker push ghcr.io/sikijs/yourhonor-ai/backend:latest
```

**6. Update the image tag in docker-compose.yml**

Edit `docker/docker-compose.yml` and change the `image:` line to the new version tag:
```
image: ghcr.io/sikijs/yourhonor-ai/backend:vX.Y.Z
```

Then commit and push:
```bash
git add docker/docker-compose.yml
git commit -m "Bump image tag to vX.Y.Z"
git push
```

**7. Restart your local container**
```bash
cd docker
docker compose pull
docker compose up -d
```
