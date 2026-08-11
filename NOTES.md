# Notes

> **Version 1.4.0**

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

## Architecture Explained (Layman's Guide)

Think of YourHonor AI as a small law firm:

| Room | What's in it |
|------|-------------|
| **Your browser (Frontend)** | The reception area — menus, forms, buttons. It only shows and collects information |
| **The office (Backend)** | The lawyers' desks — every request you make lands here: it reads your input, gathers materials, and decides what to do |
| **Storage rooms** | Where materials live: SQLite (client files: accounts, saved documents), Qdrant (a searchable library of legal text), templates (24 blank form templates) |

And two outside consultants:

- **OpenRouter + Cerebras (the AI expert)** — a paid LLM service that does the actual "thinking": writing, analysis, and Q&A
- **CourtListener (the courthouse archive)** — a free public database of real US court opinions

**How a request flows (e.g. you click "Generate Case Brief"):**

Almost every tool follows the same 7-step recipe. Here's the whole journey, from click to screen:

1. **You click "Generate"** — the frontend packs your query (plus any extras, like the selected summary type or an uploaded PDF) into a message and sends it to the backend over **HTTP** — the same request format your browser uses to load any website. The message carries your login cookie so the backend knows who you are.

2. **The backend route says hello** — the frontend's HTTP request arrives at FastAPI, which matches the URL (e.g. `POST /api/legal/case-brief`) to a small route function in a route file (e.g. `backend/app/api/legal.py`). The route is a receptionist, not a lawyer: it contains no business logic. It does two things: (a) it reads your login cookie (a JWT), decodes it, and extracts your user id — if the cookie is missing or invalid, the request is rejected with a 401 before any work happens; (b) it hands your query to the matching service (e.g. `case_brief.py`), which does the real work, then sends the service's answer back as JSON (wrapping any failure into a clean error code rather than a crash).

3. **Find the source material (the retrieval step)** — the most important part of the recipe: the AI works far better when given real text instead of relying on memory. The service hunts for source text through a waterfall of four buckets, in order:
   - **Your uploaded PDF** — if you selected one, its extracted text is used directly
   - **The app's library (Qdrant)** — your query is converted into a list of numbers (an "embedding") that captures its *meaning*, not its words. Qdrant compares that fingerprint against every stored chunk of legal text and returns the closest matches (top 10, score ≥ 0.5). Matched chunks from the best-matching case are stitched back together in order to reconstruct the opinion text
   - **CourtListener (the courthouse)** — if the library has nothing, and you've configured a CourtListener token, the backend asks the real US court opinion database. Answers are cached in SQLite, so each case crosses the network only once
   - **Fallback** — if all buckets are empty, the service continues anyway, telling the AI to give a general educational overview rather than pretend it has the case

4. **Assemble the prompt** — the service wraps everything into a prompt with two parts: a **system prompt** (fixed instructions that make the AI behave like a law professor or brief-writer, listing exactly the sections it must produce) and a **user prompt** (your query + the retrieved text). The AI is told to reply as JSON in a fixed shape.

   *Why does retrieval (step 3) come before this step?* Because the retrieved text is the *stuffing* inside the prompt sandwich — the user prompt isn't complete until the source material exists. The only part of the prompt that exists before step 3 is the fixed system prompt (it's written once, in the service code, and never changes between requests). The user prompt is built only after a bucket has produced source text, so the order can't be reversed: find the material first, then wrap it into the request to the AI.

5. **Ask the AI** — the prompt travels over the internet to the qwen model via LiteLLM → OpenRouter → Cerebras (the paid "AI expert"). This is the *only* step where data leaves your computer.

6. **Check the answer** — the model's raw reply is a JSON blob. The backend parses it and validates every field against a **Pydantic schema** (the agreed shape — e.g. `facts`, `holding`, `reasoning`). Anything missing or mistyped is caught here, which is why every tool's output looks neat and consistent. The service also auto-saves the result to My Documents.

7. **Render the result** — the validated response goes back to the frontend, which displays it in a formatted card with a **Source Panel** listing exactly which materials were used, so you can check the AI's work.

That's the loop for every AI tool — Case Briefs, Summaries, Arguments, Memoranda, Debate, Issue Spotter, Glossary. The only variations are which bucket step 3 finds and which sections the prompt demands.

**CourtListener, in more detail**

CourtListener (courtlistener.com) is a free, public database of real US court opinions, run by the non-profit Free Law Project. YourHonor AI talks to it over its REST API — it's the app's "courthouse archive": the only way to get genuine full case opinions that aren't already in the app's own library.

**What it needs from you:** a free token. Sign up at courtlistener.com and put it in `.env` as `COURTLISTENER_TOKEN`. The app works without it — searches still run and return case metadata (name, court, date, citation) — but the *full opinion text* (the part the AI actually reads to write a brief) is only downloadable with a token.

**How a lookup works** (when the app's own library misses):

1. **Cache check first** — the query is cleaned (e.g. the citation "384 U.S. 436" is stripped from "Miranda v. Arizona, 384 U.S. 436" so the search matches on the case name) and looked up in the SQLite `opinions_cache` table. If this case was fetched before, the stored opinion is returned instantly — no network call at all
2. **Citation lookup** — the query is sent to CourtListener's `/citation-lookup/` endpoint, which resolves an exact citation to the case it points to. This works when a precise citation is available
3. **Keyword search** — if citation lookup finds nothing, the query is sent to the `/search/` endpoint (Google for court opinions). The top 3 hits come back scored by relevance, and the best match is chosen
4. **Fetch the opinion** — with the matched case's opinion ID, the app downloads the full opinion from `/opinions/{id}/`. Opinions arrive in several formats; the app tries plain text first, then HTML variants (tags stripped), then Harvard XML — whichever yields readable text wins
5. **Store for next time** — metadata + full text are written into the SQLite cache, so the same case is never downloaded twice. Two smaller in-memory caches (HTTP responses and opinion text, both ~5 minutes) cover repeat lookups within a session

**Playing nice with the API:** CourtListener rate-limits requests (HTTP 429). The connector waits out the `Retry-After` delay (capped at 15 seconds) and retries twice before giving up. The same courtesy is why the 70 landmark cases are pre-ingested carefully — all 70 ship pre-seeded in the Docker image (`landmark_seed.json`), so boot needs no network at all; runtime fetching is only a fallback for cases CourtListener cannot resolve.

**Where it shows up in the app:**
- **Case Briefs** — the main consumer: library miss → CourtListener fetch → AI brief written from the real opinion text
- **Memoranda** — searches CourtListener for reference materials to ground the memo
- **Landmark pre-ingestion** — on startup the app embeds all 70 famous cases (all 70 shipped pre-seeded in the image) into the Qdrant library, which is why cases like Miranda and Roe v. Wade are available instantly (and offline of CourtListener) afterwards

**Small variations by tool:**
- **Chat** keeps a conversation history (last 10 messages), so step 4 also includes what you and the AI said earlier
- **AI Tutor** stores sessions in the backend's memory: it tracks your score, attempts per question, and difficulty. The reference answer is fetched from the curriculum library and *hidden from you* — used only for grading
- **Generate Document** pulls the template's field list in step 2, so step 4 asks the AI to fill exactly those fields
- **Citations** is strict: it extracts only authorities that actually appear in the retrieved opinion text — the AI is not allowed to invent any
- All errors along the way (API down, credits exhausted) are caught and translated into friendly messages instead of raw technical errors

**Why retrieve before asking the AI?** The AI model doesn't reliably "know" the law — it can guess. Retrieval hands it real text to work from, which reduces hallucinations and gives you traceable sources. Every answer shows which sources were used.

**Where things live:**

- **SQLite** (`backend/app/data/yourhonor.db`) — accounts, saved documents, citation cache. Recreated fresh each time the container starts
- **Qdrant** (`data/qdrant_storage/`) — embedded text: 70 landmark cases, the tutor's question cards, glossary definitions, your uploaded PDFs
- **Templates** (`templates/` + `catalog.json`) — the 24 document templates used by Generate Document
- **The frontend is pre-built** — the React app is compiled into static files that FastAPI serves directly, so the whole app runs as one server (plus one Qdrant container)

**SQLite vs Qdrant — two very different storage rooms**

The app stores things in two places, and they do *different* jobs. If you need to look something up by an exact label ("whose account is #42?", "show me user 7's saved documents"), that's SQLite. If you need to find text by *meaning* ("show me chunks about the exclusionary rule" when the exact words are never typed), that's Qdrant.

| | **SQLite** | **Qdrant** |
|---|---|---|
| **Kind of database** | Relational (SQL) — data sits in tables of rows and columns | Vector — data sits in "points", each a list of numbers plus attached metadata |
| **What it stores** | `users` (email, password hash), `documents` (saved briefs, memos, notes), `opinions_cache` (CourtListener results, with a `qdrant_ingested` flag tracking whether the case was already embedded), `review_progress` (AI Tutor progress) | Embedded *chunks* of legal text: each case opinion is cut into ~512-token pieces (with 128-token overlap so context isn't lost at the seams), and each chunk is embedded into a 384-number vector by the all-MiniLM-L6-v2 model, stored together with a payload of metadata — title, source, chunk index, citation, court, date filed, doc type |
| **How it's stored** | One single file on disk (`yourhonor.db`) — every row in a table | A separate database container (`data/qdrant_storage/`) holding three collections: `legal_documents` (~3,500 chunks from 70 landmark cases + user uploads), `tutor_curriculum` (160 study cards), `glossary_seed` (123 glossary terms) |
| **How it's indexed** | Primary keys and unique constraints (B-tree indexes) on the exact-value columns: user id, email, document id, cache query key | HNSW (approximate nearest-neighbour) index over the 384-dimension vectors, plus keyword payload indexes on `title` and `source` so filtered lookups don't scan everything |
| **How it's retrieved** | SQL queries with `WHERE` clauses — exact equality: "find the row where `query_key = 'miranda v arizona'`" | The query itself is embedded into a vector, then Qdrant finds the vectors closest to it by cosine similarity, returning only hits above a score threshold (e.g. top 10, score ≥ 0.5) |
| **Example question it answers** | "Does user 3 own document 12?" — precise, requires an exact match | "Which chunks talk about *this* legal concept?" — fuzzy, matches by meaning, so synonyms and paraphrases work |
| **Serves the app by** | Auth, My Documents, and the CourtListener cache — anywhere you must find a specific record instantly | RAG retrieval — the step that hands the AI real source text to reduce hallucinations |

**Docker:** packages the app so it runs identically anywhere — two containers, `backend` (Python app + prebuilt frontend) and `qdrant` (vector database). The image is pre-built automatically on GitHub and pulled when you start the app; if the pull fails, it builds from source instead.

---

## Every Feature Explained Simply

### Chat
Like texting a tutor. Type any legal question and the AI answers conversationally, remembering the last 10 messages so you can go back and forth. When helpful, it quietly pulls relevant case text from its library to ground the answer, and shows the sources at the bottom. **Use it for** open-ended questions, brainstorming, and clarifying concepts before switching to a structured tool.

### Case Briefs
The "cliff notes" of a court case. Type a case name (e.g. "Miranda v. Arizona") or pick one of your uploaded PDFs, and the app finds the opinion text — first by searching its own library (70 landmark cases + user uploads), and if that misses, by fetching the real opinion from CourtListener (fetched only once per case thanks to caching). The AI then fills in all 10 standard brief sections: **Facts, Procedural History, Issues, Holding, Reasoning, Rule of Law, Concurrence, Dissent, Significance, and Sources**. **Use it for** fast exam prep — grasping the essentials of any case in minutes.

### Summaries
A condensed overview of any legal topic, in four flavours — pick one from the dropdown, and the output adapts:
- **General** — a balanced overview of anything (overview, key findings, legal principles, impact, key points)
- **Case Summary** — parties, procedural posture, issue, holding, reasoning, disposition
- **Statute Summary** — a law's purpose, scope, key provisions, elements, penalties, remedies
- **Legal Doctrine** — the rule, its tests, origin, landmark cases, exceptions, modern application

**Use it for** quickly grasping a case, statute, or doctrine without reading the full text.

### Arguments
The anatomy of a court fight. Give it a case or topic, and it extracts the arguments **petitioner vs. respondent** — each side's arguments, the reasoning behind them, the authorities cited, and how the court resolved each one — plus counterarguments the court considered, key doctrines, and the winning party with the court's rationale. **Use it for** understanding both sides' case theories before moot court or a debate.

### Citations
The family tree of the law. Give it a case, and it maps every authority the opinion cites: **cases** (full citation, why it was cited, and how it was treated — followed, distinguished, overruled, abrogated...), **statutes**, and **constitutional provisions**, plus a total count and which single authority was the key precedent and why. **Use it for** seeing how a case fits into a doctrine and finding its most important authority.

### Memoranda
Drafts a law-firm style legal memo. Type a legal question and get a complete memo with a **TO / AUTHOR / DATE / RE** header, **Question Presented, Brief Answer, Facts**, then one **IRAC** block per issue (**Issue, Rule, Application, Conclusion**), an **Overall Conclusion**, and Sources. **Use it for** practicing the standard internal legal-analysis format used in real law firms.

### Debate
Argues both sides of a legal question for you. State a position (e.g. "schools may search student phones without a warrant") and it returns **supporting arguments and opposing arguments** — each with its reasoning, authorities, a strength rating (strong/moderate/weak), and a *counter-rebuttal* showing how the other side would respond — plus key doctrines, a **predicted winner**, the rationale, and practice tips for arguing each side. **Use it for** finding the weak spots in your own position and prepping for oral advocacy.

### Issue Spotter
Exam practice. Paste a fact pattern — a story full of legal problems — and it identifies **every issue** in it. Each issue gets the full treatment: **Issue, Rule, Application, Conclusion, Missing Information, and Relevant Authorities**, and results are grouped by legal area (e.g. Fourth Amendment, Contracts, Torts) with an overview and tips for writing the exam answer. It's deliberately thorough: in law school exams, missing an issue costs more than over-identifying one. **Use it for** drilling exam-style fact patterns.

### AI Tutor
Socratic dialogue. Pick one of 8 subjects (160+ curated questions) and click **Start**, or click **AI Quick Start** to have the AI generate fresh questions on the spot. The tutor asks a question, you answer in your own words, and it **evaluates your answer against the card's model answer** (the reference answer is hidden — it's only used for grading), scores you, and adapts: follow-up scaffolding questions, difficulty scaling from 2–4, and up to 3 attempts before the correct answer is revealed. Progress is tracked and reviewable later. **Use it for** active-recall practice and self-testing.

### Generate Document
A drafting assistant. Chat with the AI to figure out which document you need from the catalog of **24 templates** (agreements, contracts, briefs, etc.), and it helps you supply the fields (parties, dates, amounts...), then produces the finished document and saves it to My Documents. **Use it for** drafting routine documents conversationally without knowing the format yourself.

### My Documents
Your personal filing cabinet. Every tool can save its output here, and you can upload PDFs, view them, and delete them. Uploaded PDFs also become usable sources — most tools let you select a PDF so the analysis is based on *your* document rather than the app's library. **Use it for** keeping all your briefs, memos, and source materials in one place.

### Glossary
Type a legal term and get a plain-English definition. Lookups run through a three-step ladder: 1) **keyword match** against 123 curated definitions, 2) **semantic match** (vector search, only served when high-confidence), 3) **AI-generated** definition as fallback. Each entry includes the definition, etymology, jurisdiction, a usage example, related terms, alternative names, practice tips, and citations. **Use it for** quick term lookups mid-study.

### Resources
Static educational pages — how-to guides for the tools and legal tech reading material. No AI involved.

### ScratchPad
A small on-screen notepad that stays available while you're signed in — handy for jotting thoughts while you work. It saves automatically in the background.

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
| Frontend changes not showing in browser | Browser cache or stale static files | Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows). If you edited `frontend/src/`, run `bash scripts/sync-frontend.sh` (rebuilds the frontend and copies it into the Docker image), then rebuild: `docker compose -f docker/docker-compose.yml build backend && docker compose -f docker/docker-compose.yml up -d backend` |
| Can't sign in / user missing | Database was deleted or reset | Just sign up again with the same email — fresh account |
| Signed out after restarting the app | JWT secret is auto-generated and changes every boot | Normal — just sign in again. Your saved documents are still there |
| Scripts won't run on Mac (quarantine warning) | macOS blocks unsigned `.command` files from the internet | Run: `xattr -dr com.apple.quarantine /path/to/YourHonor-AI-main` then try again |
| Qdrant connection refused on startup | Qdrant is slower to start than the backend | Normal — the health check retries up to 5 times over 60 seconds. Wait a moment and refresh |
| App slow / landmark cases missing right after startup or a wipe | Background pre-ingestion of the 70 landmark cases is still running (all 70 ship pre-seeded in the image; only rare cases may be fetched from CourtListener, 12 seconds apart — takes a few minutes) | Normal — wait a few minutes, then refresh. Cases like Miranda and Roe v. Wade become available as ingestion completes |
| Case Brief returns "No case information found" | Library miss + no CourtListener token configured | Add `COURTLISTENER_TOKEN` to `.env` (free at courtlistener.com), then restart. Without it the app can only search metadata, not download full opinions |
| Case Brief has metadata but thin/no opinion detail | "Set COURTLISTENER_TOKEN for full opinion text" — token missing | Same fix: add the token and restart. The full opinion text is only downloadable with a token |
| CourtListener lookups failing (401) | Token invalid or expired | Log in at courtlistener.com and regenerate the token, update `.env`, restart |
| First CourtListener fetch is slow (10-30s) | Rate limiting — the app waits out the retry delay (up to 15s per retry) | Normal — it's cached in SQLite afterwards, so the next lookup of the same case is instant |
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
