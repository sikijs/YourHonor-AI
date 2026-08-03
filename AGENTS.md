
# YOURHONOR AI  ----   Platform & AI Agent Guidelines

> **Current Version: 1.3.0**

## Project Overview

This project is a standalone Docker-based legal AI application designed primarily for law students and legal education.

The system will help users:

- Search legal documents and legal databases
- Analyze statutes and case law
- Generate case briefs
- Generate legal memorandums
- Summarize complex legal material
- Identify legal arguments and counterarguments
- Support AI-assisted legal research
- Eventually support predictive legal analytics

This project is educational software and must NOT present outputs as professional legal advice.

This is a SaaS product to allow students/users to attain basic legal jurispudence and to search legal statutes and documents from legal databases, analyze and draft legal briefs/agreements based on templates in the templates directory. The user can carry out AI chat in order to establish what document they want and how to fill in the fields. The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation supports all 11 document types via AI chat with full user authentication and document persistence.

The content for a "Welcome page" for the user on the app is available in the file located in the project root directory.

@AI-in_Law.md 

Accuracy, transparency, traceability, modularity, and maintainability are top priorities.

---


# Core Engineering Philosophy

## Development Principles

1. Plan before building
2. Build incrementally
3. Keep architecture modular
4. Prefer simple solutions over clever abstractions
5. Prefer explicit code over hidden magic
6. Keep AI components replaceable
7. Docker-first development
8. Test each layer independently
9. Maintain clean separation of concerns
10. Reduce hallucinations wherever possible
11. Develop the feature - do not skip any step from the feature-dev 7 step process
12. Thoroughly test the feature with unit tests and integration tests and fix any issues


---


# AI Agent Operating Rules

## The AI agent MUST:

- Explain architectural decisions before implementing them
- Explain all new dependencies before adding them
- Keep implementations modular
- Prefer maintainable code over compact code
- Add comments where educational value exists
- Keep code beginner-friendly when possible
- Respect the existing architecture
- Build features incrementally
- Use environment variables for configuration
- Design systems for future scalability

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the qwen/qwen3-14b model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## The AI Agent MUST NEVER:

- Generate giant monolithic files
- Silently refactor major architecture
- Invent APIs that do not exist
- Add dependencies without explanation
- Mix frontend and backend concerns
- Hardcode secrets or API keys
- Implement unrequested features
- Create unnecessary abstractions
- Generate placeholder fake production logic
- Bypass Docker workflows
- Make cloud-only assumptions
- Present AI outputs as legal advice
- Remove existing files without explanation

---


# Preferred Technology Stack

## Backend

- Python 3.12+
- FastAPI
- Pydantic
- Uvicorn

## Frontend

- React
- Next.js
- TypeScript

## AI / RAG

- LlamaIndex or LangChain
- Ollama for local models
- OpenAI-compatible providers optional
- Sentence Transformers for embeddings

## Databases

- SQLite (local development)
- Qdrant preferred for vector storage

## Infrastructure

- Docker
- Docker Compose

---


# Architecture Rules

The entire project should be packaged into a Docker container.
The backend should be in backend/ and be a uv project, using FastAPI.
The frontend should be in frontend/
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.
Consider statically building the frontend and serving it via FastAPI, if that will work.


# Color Scheme

Accent Yellow: #ecad0a
Blue Primary: #209dd7
Purple Secondary: #753991 (submit buttons)
Dark Navy: #032147 (headings)
Gray Text: #888888


# Implementation Status

There should be scripts in scripts/ for:

## Mac
setup.command                    # Interactive setup (API key, CourtListener)
🟢 Start YourHonor AI.command    # Start app (port fallback, pre-built pull)
🔴 Stop YourHonor AI.command     # Stop app

## Linux
scripts/setup-linux.sh
scripts/start-linux.sh
scripts/stop-linux.sh

## Windows
setup.bat
🟢 Start YourHonor AI.bat
🔴 Stop YourHonor AI.bat

The Docker image is pre-built via GitHub Actions (.github/workflows/publish-image.yml) and
pushed to ghcr.io/sikijs/yourhonor-ai/backend:latest. Start scripts try pull first, then
fall back to local build.

A student-friendly landing page is at docs/index.html, served via GitHub Pages at
https://sikijs.github.io/YourHonor-AI/

Backend available at http://localhost:8000


## Current API Endpoints

### Auth
- POST /api/auth/signup - Create new user account
- POST /api/auth/signin - Sign in and receive JWT cookie
- POST /api/auth/signout - Clear auth cookie
- GET /api/auth/me - Get current user info

### Documents
- GET /api/documents - List user's saved documents (auth required)
- POST /api/documents - Save new document (auth required)
- GET /api/documents/{id} - Get specific document (auth required)
- PUT /api/documents/{id} - Update document (auth required)
- DELETE /api/documents/{id} - Delete document (auth required)

### Chat
- GET /api/chat/greeting - Get AI greeting
- POST /api/chat/message - Send chat message with optional conversation history and get AI response

### Tutor
- GET  /api/tutor/topics             - List available topics with question counts
- POST /api/tutor/start              - Start a session (hardcoded questions)
- POST /api/tutor/start-dynamic      - Start a session (LLM-generated questions)
- POST /api/tutor/answer             - Submit answer and get evaluation + follow-up
- POST /api/tutor/continue-learning  - Generate a new dynamic question mid-session

### Legal Tools
- POST /api/legal/case-brief       - Generate structured case brief
- POST /api/legal/summary          - Summarize legal content
- POST /api/legal/arguments        - Extract legal arguments
- POST /api/legal/citations        - Generate citation map
- POST /api/legal/memorandum       - Draft IRAC-style legal memorandum
- POST /api/legal/glossary         - Define legal term

### Debate
- POST /api/legal/debate           - Analyze both sides of a legal question

### RAG
- POST /api/rag/retrieve          - Retrieve relevant context
- POST /api/rag/ingest            - Ingest a document
- GET  /api/rag/collection/stats  - Get collection statistics

### Other
- GET /api/health - Health check
- GET /api/check-update - Check if a newer version is available on GitHub

---

## Current Implementation Status

### Phase 1 (Foundation) - COMPLETE
- Docker + FastAPI backend
- React frontend
- User authentication (JWT cookies)
- Document storage API
- Start/stop scripts for Mac/Linux/Windows

### Phase 2 (Document Ingestion) - COMPLETE
- PDF upload (POST /api/documents/upload)
- Text extraction (pypdf/PdfReader)
- OCR support (future upgrade — scanned PDFs not yet supported)

### Phase 3 (Basic RAG) - COMPLETE
- Legal document chunking (LangChain)
- Sentence Transformers embeddings (all-MiniLM-L6-v2, 384 dim)
- Qdrant vector database (v1.18)
- Retrieval API (/api/rag/retrieve, /api/rag/ingest, /api/rag/collection/stats)
- LLM + RAG integration (qwen/qwen3-14b via LiteLLM/OpenRouter)
- Educational disclaimers and source citations

### Phase 4 (Legal Intelligence) - COMPLETE
- Case brief generation
- Legal summaries
- Argument extraction
- Citation mapping
- CourtListener connector with citation-lookup API, rate-limit retry, in-memory + SQLite caching
- SQLite opinions_cache table with qdrant_ingested tracking
- Auto pre-ingestion of 24 landmark cases from CourtListener into Qdrant at startup (background thread, 12s delay between cases for rate limits)
- Progress tracking: cache hit → skip API, cache miss → fetch → cache → ingest → mark done

### Phase 5 (Advanced Features) - COMPLETE
- Memorandum drafting
- Predictive analytics (future development)
- AI tutor features — Socratic dialogue across 8 topics, 160+ hardcoded questions, AI Quick Start dynamic generation via LLM, difficulty scaling 2-4, follow-up scaffolding, flashcard review
- Multi-turn chat with conversation history (10-turn context window)
- Debate/counterargument engine — analyze both sides of a legal question with structured counterpoints

### Phase 6 (Error Handling) - COMPLETE
- `app/services/llm_errors.py` — Detects OpenRouter payment/credit errors and returns a user-friendly message: *"Your OpenRouter credits are exhausted. Add funds at openrouter.ai/settings/credits to continue."* instead of raw API errors
- All 9 LLM service files route errors through `friendly_llm_error()`

### Phase 7 (Version Awareness) - COMPLETE
- App version (`v1.3.0`) displayed in the footer on every page
- "Check for Updates" button calls `GET /api/check-update` which fetches the latest release from the GitHub API
- Yellow banner with download link + upgrade instructions shown when a newer version exists
- Green "up to date" banner when the current version matches the latest release
- Version constants in `backend/app/main.py` (`APP_VERSION`), `frontend/next.config.js` (`NEXT_PUBLIC_APP_VERSION`), and `frontend/package.json` / `backend/pyproject.toml`

---

## RAG Content Inventory

| Source | Documents | Chunks |
|--------|-----------|--------|
| Legal Templates | 11 | 34 |
| US Constitution | 1 | 13 |
| Supreme Court Cases | 8 | 8 |
| Landmark Cases (pre-ingested, pending) | 24 | ~120 |
| **Total** | **~44** | **~175** |

**Sample landmark cases ingested:**
- Criminal Procedure: Gideon v. Wainwright, Miranda v. Arizona
- Constitutional Law: Roe v. Wade, Dobbs v. Jackson, Obergefell v. Hodges
- First Amendment: Employment Division v. Smith, Miller v. California
- Privacy: Lawrence v. Texas, Griswold v. Connecticut
- Civil Procedure: Erie v. Tompkins, Twombly/Iqbal
- Second Amendment: District of Columbia v. Heller
- Campaign Finance: Citizens United v. FEC
- Voting Rights: Shaw v. Reno, Baker v. Carr
- Civil Liberties: Korematsu v. United States

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| qwen/qwen3-14b model | Better legal reasoning than llama-3.1-8b-instruct |
| Qdrant v1.18 | Required for qdrant-client compatibility |
| qdrant_client.query_points() | Not search() - Qdrant 1.18+ API |
| Direct bcrypt (no passlib) | Fixed bcrypt__truncate_error |
| all-MiniLM-L6-v2 embeddings | Fast, 384-dim, good quality |


# High-Level Structure

The application should remain modular and service-oriented.

Preferred major folders:

```text
/backend
/frontend
/rag
/connectors
/docker
/docs
/data
/models
/scripts
/tests
```

---


# Backend Rules

## Backend Responsibilities

The backend handles:

- API endpoints
- Authentication
- Document ingestion
- PDF processing
- RAG orchestration
- Embeddings
- AI model orchestration
- Legal search pipelines
- Citation tracking
- Logging and observability

## Backend Standards

- Use FastAPI routers
- Use service layers
- Keep business logic separate from routes
- Avoid massive utility files
- Use typed models everywhere
- Use async where appropriate
- Use structured logging

---


# Frontend Rules

## Frontend Responsibilities

The frontend handles:

- User interaction
- Upload interfaces
- Chat interfaces
- Search interfaces
- Legal document viewing
- Citation display
- Visualization tools

## Frontend Standards

- Use reusable components
- Avoid oversized components
- Keep business logic out of UI components
- Use TypeScript strictly
- Keep styling modular
- Prioritize accessibility and readability

---


# Docker Rules

## Docker Philosophy

The entire application must run consistently through Docker.

All services should be containerized where practical.

Preferred containers:

- frontend
- backend
- postgres
- qdrant
- ollama
- redis (optional)

## Docker Standards

- Use docker-compose for local orchestration
- Keep containers isolated
- Use environment variables
- Avoid hardcoded ports
- Keep Dockerfiles clean and minimal
- Use volumes appropriately
- Keep startup predictable

---


# RAG Architecture Principles

## Retrieval-Augmented Generation (RAG)

All legal reasoning should use retrieval wherever possible.

The system should:

1. Ingest legal documents
2. Extract and clean text
3. Chunk documents intelligently
4. Generate embeddings
5. Store embeddings in vector DB
6. Retrieve relevant context
7. Inject retrieved context into prompts
8. Return sourced responses

## Hallucination Reduction

Hallucination reduction is a top priority.

The AI must:

- Prefer retrieved legal sources
- Cite sources whenever possible
- Distinguish facts from AI interpretation
- Avoid fabricating citations
- Avoid unsupported legal claims

---


# Legal Research Principles

## Legal Outputs

The system should clearly distinguish:

- Source material
- AI summaries
- AI interpretations
- AI-generated arguments

## Disclaimer Requirements

Legal outputs should eventually include disclaimers that:

- The system is educational software
- Outputs are not legal advice
- Users should verify all legal conclusions

---


# File Size & Complexity Limits

Preferred limits:

- Python files: under 300 lines
- React components: under 250 lines
- Functions: under 40 lines where practical
- Avoid deeply nested logic

If a file becomes too large:
- split services
- split components
- split utilities
- split responsibilities

---


# Dependency Rules

Before adding any dependency:

The AI agent must explain:

1. Why it is needed
2. Alternative options
3. Tradeoffs
4. Security implications
5. Docker implications

Avoid unnecessary dependencies.

Prefer stable and well-maintained libraries.

---


# Security Principles

The system should be designed with security in mind from the beginning.

## Security Requirements

- Never hardcode secrets
- Use .env files
- Validate uploads
- Sanitize inputs
- Log safely
- Isolate containers
- Minimize exposed services
- Assume uploaded documents may be sensitive

---


# Logging & Observability

The system should support:

- Structured logging
- Error tracking
- Request tracing
- Container diagnostics

Logging should help debugging without exposing sensitive data.

---


# Development Workflow

## Preferred Workflow

1. Use Plan Mode first
2. Confirm architecture
3. Build incrementally
4. Test frequently
5. Keep commits small
6. Refactor carefully
7. Document major decisions

### Syncing frontend/public/ → backend/app/static/

When editing files in `frontend/public/` (e.g. `legal-tech-tools.md`), you must sync them to `backend/app/static/` to see changes on the running app:

    cp frontend/public/legal-tech-tools.md backend/app/static/legal-tech-tools.md
    docker cp backend/app/static/legal-tech-tools.md docker-backend-1:/app/app/static/legal-tech-tools.md

This keeps the local and in-container copies in sync.

### Syncing the built frontend → backend/app/static/

The Docker image ships the frontend as a pre-built static bundle inside `backend/app/static/` (the image is built from `backend/`, and `Dockerfile.backend` does NOT build the frontend). After ANY change to `frontend/src/`, run the sync script BEFORE rebuilding the Docker image, or the app will keep serving the stale bundle:

    bash scripts/sync-frontend.sh

This rebuilds the frontend (`npm run build`) and copies `frontend/out/` into `backend/app/static/`, mirroring what `.github/workflows/publish-image.yml` does. Then rebuild and restart the container:

    docker compose -f docker/docker-compose.yml build backend
    docker compose -f docker/docker-compose.yml up -d backend

---


# Implementation Phases

## Phase 1 — Foundation

- Project scaffolding
- Docker setup
- FastAPI backend
- React frontend
- Health endpoints
- Logging
- Environment configuration

## Phase 2 — Document Ingestion

- PDF upload
- Text extraction
- OCR support
- Document storage

## Phase 3 — Basic RAG

- Chunking
- Embeddings
- Vector database
- Retrieval API

## Phase 4 — Legal Intelligence

- Case brief generation
- Legal summaries
- Argument extraction
- Citation mapping

## Phase 5 — Advanced Features

- Memorandum drafting
- Predictive analytics
- Legal reasoning graphs
- AI tutor features
- Debate/counterargument engine

---


# Documentation Requirements

Major systems should include documentation.

Preferred documentation:

```text
/docs/architecture.md
/docs/api-design.md
/docs/rag-design.md
/docs/docker-setup.md
/docs/roadmap.md
```

---


# Coding Style

## Preferred Style

- Readable
- Explicit
- Modular
- Predictable
- Maintainable

Avoid:
- premature optimization
- excessive abstraction
- hidden logic
- magic behavior

---


# Final Guiding Principle

This project is intended to become a trustworthy educational legal AI platform.

The primary goals are:

- Trustworthiness
- Explainability
- Modularity
- Scalability
- Educational value
- Maintainability

The AI agent should optimize for long-term project health rather than short-term code generation speed.