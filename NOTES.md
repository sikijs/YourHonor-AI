# Notes

> **Version 1.3.0**

Quick reference for managing YourHonor AI.

---

## Sharing the App

When someone asks to try YourHonor AI, send them this link:
**https://sikijs.github.io/YourHonor-AI/**

That landing page has everything they need: Docker Desktop install, OpenRouter API key setup, download link, and step-by-step instructions. No technical explanation needed on your end.

---

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

## Project Map

```
YourHonor AI/
├── AGENTS.md               # AI agent operating instructions
├── NOTES.md                # <- you are here
├── README.md               # Student setup guide
├── catalog.json            # Document template catalog (24 templates)
├── AI_in_Law.md            # Welcome page content
├── .env                    # API keys & secrets (not committed to git)
│
├── backend/                # Python FastAPI server
│   ├── app/
│   │   ├── main.py         # App entry point, version constant, router registration
│   │   ├── api/            # 11 route files (thin layer — delegates to services)
│   │   ├── services/       # 25 service files (all business logic lives here)
│   │   ├── models/         # 17 Pydantic schemas (request/response types)
│   │   ├── data/           # SQLite database (yourhonor.db)
│   │   ├── static/         # Built frontend (copied from frontend/out/)
│   │   └── uploads/        # User-uploaded PDFs
│   ├── connectors/
│   │   └── courtlistener.py
│   └── pyproject.toml      # Python dependencies & version
│
├── frontend/               # Next.js React app
│   ├── src/
│   │   ├── app/            # page.tsx (SPA), layout.tsx, globals.css
│   │   ├── components/     # 21 view components (one per tool)
│   │   └── lib/            # api.ts (typed API client), print.ts, sources.ts
│   ├── public/             # Static assets (logo, favicon, md files)
│   ├── next.config.js      # Frontend version constant
│   └── package.json
│
├── docker/
│   ├── docker-compose.yml  # Defines backend + qdrant services
│   ├── Dockerfile.backend  # How the backend image is built
│   └── data/               # Bind-mounted data (SQLite, uploads) inside Docker
├── docs/index.html         # GitHub Pages landing page (sikijs.github.io/YourHonor-AI/)
├── templates/              # 24 legal document templates (.md)
├── scripts/                # Setup & start/stop for Mac / Windows / Linux
├── data/qdrant_storage/    # Vector database files (embeddings, landmark cases)
└── .github/workflows/      # CI: auto-builds + publishes Docker image on push
```

## Data Locations

| What | Where | Notes |
|------|-------|-------|
| SQLite database | `backend/app/data/yourhonor.db` | Users, documents, opinions_cache, notes tables |
| Uploaded PDFs | `backend/app/uploads/` | Created when a user uploads a document |
| Qdrant vectors | `data/qdrant_storage/` | Contains embedded legal content (landmark cases, templates, Constitution) |
| Docker bind mount | `docker/data/` | Mirrors SQLite + uploads inside the running container |
| Frontend build output | `frontend/out/` → copied to `backend/app/static/` | Built with `npm run build`, then copied for Docker deployment |
| App logs | `docker compose logs backend` | Real-time or tail with `docker compose logs -f` |
| Container logs (past) | `docker inspect <container> --format='{{.LogPath}}'` | On-disk log files (rarely needed) |

## .env File Reference

File location: `.env` in the project root. Loaded automatically by docker-compose.

| Variable | Required | What it does |
|----------|----------|--------------|
| `OPENROUTER_API_KEY` | **Yes** | LLM access via OpenRouter — powers Chat, Tutor, Issue Spotter, Case Briefs, and all AI tools |
| `CEREBRAS_API_KEY` | **Yes** | Cerebras inference provider — used as the compute backend for OpenRouter calls |
| `COURTLISTENER_TOKEN` | No (recommended) | Free CourtListener account token — enables real case law lookups via the CourtListener API. Sign up at courtlistener.com to get one |
| `JWT_SECRET` | Auto-generated | Signs login cookies. If missing, the app generates one automatically on startup |
| `APIFY_TOKEN` | No | Apify API token (not currently used by the app) |

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

## Syncing frontend/public/ When Using Docker

Files in `frontend/public/` (e.g. `legal-tech-tools.md`) are served by FastAPI from `backend/app/static/`. After editing, sync both locally and into the running container:

```bash
cp frontend/public/legal-tech-tools.md backend/app/static/legal-tech-tools.md
docker cp backend/app/static/legal-tech-tools.md docker-backend-1:/app/app/static/legal-tech-tools.md
```

Then hard refresh (`Cmd+Shift+R`) in the browser.

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

## After a Restart (Laptop, Docker Desktop, etc.)

If you've restarted your computer or Docker Desktop, get the app back with:

| Step | Command / Action | Notes |
|------|-----------------|-------|
| **1. Start Docker Desktop** | Open Docker Desktop from Applications | Wait for the whale icon in the menu bar to stop animating. `docker info` confirms it's ready. |
| **2. Check `.env` exists** | `ls ../.env` | If missing, run `bash ../scripts/setup.command` (Mac) or `bash ../scripts/setup-linux.sh` (Linux). |
| **3. Check port 8000 is free** | `lsof -i :8000` | If nothing shows, the port is free. If a process is listed: `kill -9 <PID>`. After a restart, 8000 should always be free — no processes survive a reboot. |
| **4. Pull the latest image** | `docker compose pull` | Downloads the pre-built image from `ghcr.io/sikijs/yourhonor-ai/backend:latest`. If this fails (no internet, GitHub down, etc.), **don't worry** — step 5 will build from source automatically. |
| **5. Start the app** | `docker compose up -d` | If step 4 succeeded, this just runs the downloaded image (instant). If step 4 failed, Docker sees no image tagged `latest` and falls back to the `build:` definition in `docker-compose.yml`, building from `Dockerfile.backend` (takes 5-10 min the first time). |
| **6. Open the app** | http://localhost:8000 | |

Run all commands from the `docker/` folder:
```bash
cd ~/YourHonor\ AI/docker
```

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

## Common Problems & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "OpenRouter credits exhausted" in any AI tool | No credits left in your OpenRouter account | Go to `openrouter.ai/settings/credits` and add funds (~$5 lasts a long time) |
| `docker: command not found` | Docker Desktop not installed | Download from `docker.com/products/docker-desktop` and install |
| Port 8000 already in use | Another app or Docker container is using it | `lsof -i :8000` → find the PID → `kill -9 <PID>`. Or let the app auto-pick another port |
| Container exits immediately on start | Port conflict or database initialization failed | `docker compose logs backend` to see the exact error |
| "No module named X" error after code changes | Docker image is stale (built before your changes) | Rebuild: `docker compose up -d --build` |
| Frontend changes not showing in browser | Browser cache or stale static files | Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows). Or rebuild frontend: `cd frontend && npm run build && cp -r out/. ../backend/app/static/` |
| Can't sign in / user missing | Database was deleted or reset | Just sign up again with the same email — fresh account |
| Scripts won't run on Mac (quarantine warning) | macOS blocks unsigned `.command` files from the internet | Run: `xattr -dr com.apple.quarantine /path/to/YourHonor-AI-main` then try again |
| Qdrant connection refused on startup | Qdrant is slower to start than the backend | Normal — the health check retries up to 5 times over 60 seconds. Wait a moment and refresh |
| Disk space low | Old Docker images and build cache accumulate | `docker system prune` (add `-a` to remove all unused images, not just dangling ones) |
| "Failed to spot issues" or similar AI error | Temporary OpenRouter outage or model overload | Wait a minute and try again. If it persists, check `openrouter.ai/status` |

## How to Verify Everything is Working

Run these checks in order when you want to confirm the app is healthy:

**1. Health endpoint** — open `http://localhost:8000/api/health` in your browser. Should return:
```json
{"status":"healthy","version":"1.3.0"}
```

**2. Containers running** — run `docker ps`. Should show 2 containers:
- `docker-backend-1` — the Python/FastAPI server
- `docker-qdrant-1` — the vector database

**3. App loads** — `http://localhost:8000` should show the YourHonor AI homepage with the logo and feature cards.

**4. Auth works** — click Sign Up, create a test account (any email/password), sign in. You should see the full navigation bar.

**5. AI works** — go to **Issue Spotter**, paste a simple fact pattern like *"Officer Jones stopped a car for speeding, smelled alcohol, and searched the trunk without a warrant. He found drugs."* Click **Spot Issues**. You should get a full IRAC analysis in 5-15 seconds.

**6. Logs look clean** — run `docker compose logs backend | tail -30`. No red ERROR or TRACEBACK lines.

If all 6 pass, the app is fully operational.

## Wipe & Restart Fresh

When things are broken beyond a quick fix — this destroys all user accounts, documents, and resets the vector database:

```bash
# 1. Stop everything and delete Docker volumes (erases SQLite + Qdrant)
cd ~/YourHonor\ AI/docker
docker compose down -v

# 2. Delete the local SQLite database file
rm ../backend/app/data/yourhonor.db

# 3. (Optional) Force a fresh image pull instead of using cached build
docker rmi ghcr.io/sikijs/yourhonor-ai/backend:latest

# 4. Pull the latest image and start fresh
docker compose pull
docker compose up -d

# 5. Open the app
open http://localhost:8000
```

The Qdrant vector DB will be automatically rebuilt and landmark cases re-ingested on first startup (takes ~5 minutes with the 12-second rate-limit delay between cases).

---

## Releasing a New Version

Run all commands from `~/YourHonor AI/` unless noted.

**1. Make your code changes and commit them**
```bash
git add <files>
git commit -m "your message"
git push
```

**1.5. Run tests**
```bash
cd backend && uv run pytest && cd ../frontend && npx jest && cd ..
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
