# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Academic Research Detective** — A full-stack agentic AI application that explores academic citation networks. Users upload PDFs or enter research topics; the system recursively traverses citation networks across multiple agents and synthesizes findings.

## Commands

### Root (monorepo)
```bash
npm install          # Install all workspace dependencies
npm run dev          # Run backend + frontend concurrently
npm run build        # Build both packages
```

### Backend (`cd backend`)
```bash
npm run dev          # Start Express server with hot reload (port 3001)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled output
npm run mastra       # Launch Mastra agent dashboard (port 4111)
```

### Frontend (`cd frontend`)
```bash
npm run dev          # Vite dev server (port 5173)
npm run build        # Production bundle
npm run preview      # Preview production build
```

## Environment Setup

Copy and fill in:
- `backend/.env` — requires `GOOGLE_GENERATIVE_AI_API_KEY` (mandatory), `SEMANTIC_SCHOLAR_API_KEY` (optional), `OLLAMA_BASE_URL=http://localhost:11434`, `PORT=3001`
- `frontend/.env` — requires `VITE_API_URL=http://localhost:3001`

Ollama must be running locally with the embedding model pulled:
```bash
ollama pull nomic-embed-text
```

## Architecture

### Monorepo Structure
- `backend/src/` — Express + TypeScript backend (ESM modules)
- `frontend/src/` — React 18 + TypeScript + Vite frontend

### Agent Pipeline (7 agents, `backend/src/agents/`)

The research workflow runs sequentially:

1. **PlannerAgent** (`planner.ts`) — Decomposes PDF/topic into `goalConcepts[]` and `searchQueries[]` using Gemini 2.5 Pro thinking
2. **RetrieverAgent** (`retriever.ts`) — Searches Semantic Scholar (1 req/sec rate-limited), ArXiv, CrossRef for papers
3. **EmbedderAgent** (`embedder.ts`) — Chunks paper text and generates 768-dim vectors via Ollama `nomic-embed-text`
4. **ReasoningAgent** (`reasoning.ts`) — RAG synthesis: retrieves relevant chunks, synthesizes findings, identifies research gaps
5. **ReportAgent** (`report.ts`) — Generates markdown report + citation graph data
6. **TutorAgent** (`tutor.ts`) — Handles Q&A: embeds user question → vector search → streaming grounded answer
7. **OrchestratorAgent** (`orchestrator.ts`) — Classifies user messages as `"doubt"` (Q&A) / `"research"` / `"report"`

The full workflow loop lives in `backend/src/workflows/researchWorkflow.ts`. Gaps detected by ReasoningAgent trigger additional retrieval cycles up to `maxDepth`.

### Model Registry (`backend/src/models/registry.ts`)
At startup, fetches live Gemini model list from Google API and dynamically scores/assigns optimal models per agent role — nothing is hardcoded. Agent roles map to capability weights (thinking, output length, speed, stability).

### Databases (`backend/data/`, using LibSQL/SQLite)
- `sessions.db` — sessions, papers, messages (`backend/src/db/sessions.ts`)
- `vectors.db` — paper chunks + 768-dim embeddings with cosine similarity search in TypeScript (`backend/src/db/vector.ts`)
- `mastra.db` — Mastra agent state

### Real-time Streaming
All long-running operations stream via Server-Sent Events (SSE). The backend route (`backend/src/routes/session.ts`) broadcasts events: `agent_step`, `token`, `paper_found`, `graph_update`, `done`. The frontend hook `useResearchStream.ts` manages the SSE connection and state updates.

### API Routes
- `POST /api/sessions` — Create session
- `POST /api/sessions/:id/start` — Trigger research workflow
- `GET /api/sessions/:id/stream` — SSE connection
- `POST /api/sessions/:id/message` — User Q&A message
- `GET /api/sessions/:id/papers` — Session papers
- `GET /api/sessions/:id/messages` — Conversation history

### Frontend Pages
- `Home.tsx` — Research initiation (PDF upload or topic input)
- `Chat.tsx` — Main interface with citation graph (`CitationGraph.tsx` using `@xyflow/react` + `dagre`), papers sidebar, streaming messages

### Key Behaviors
- Semantic Scholar enforces 1 req/sec globally with retry logic on 429s
- Ollama embeddings fall back to zero vectors if unavailable; cosine similarity is computed in TypeScript
- All data persists locally in `backend/data/` — no external database required
