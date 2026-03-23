# Academic Research Detective

An agentic AI system that recursively explores academic citation networks to deeply understand research papers. Upload a PDF or enter a topic — the system decomposes the goal, retrieves papers, synthesizes findings, and lets you ask questions about anything it found.

## What it does

- **Upload a PDF or enter a topic/DOI** → agents plan, search, and synthesize automatically
- **Citation traversal** — follows reference chains up to a configurable depth (1–5)
- **Inline agent activity** — see exactly which agent is working and what it found, in real time
- **Ask doubts** — after research completes, ask any question about the papers; the tutor agent answers grounded in the actual paper text
- **Model registry** — on startup, fetches the live Gemini model list and assigns the best available model to each agent role automatically

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Agent framework | Mastra (`@mastra/core`) |
| AI models | Gemini (via `@ai-sdk/google`) — dynamically assigned |
| Local embeddings | Ollama + `nomic-embed-text` |
| Storage | LibSQL (SQLite) — sessions, vectors, Mastra state |
| Paper APIs | Semantic Scholar (primary), ArXiv, CrossRef |

## Ports

| Service | Port |
|---|---|
| Frontend | 5173 |
| Backend API | 3001 |
| Mastra dashboard | 4111 |

## Setup

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Fill in GOOGLE_GENERATIVE_AI_API_KEY and SEMANTIC_SCHOLAR_API_KEY

# 3. Pull local embedding model
ollama pull nomic-embed-text

# 4. Run app (frontend + backend together)
npm run dev

# 5. Run Mastra dashboard (separate terminal)
cd backend && npm run mastra
```

## Environment variables

```
# backend/.env
GOOGLE_GENERATIVE_AI_API_KEY=   # from aistudio.google.com
SEMANTIC_SCHOLAR_API_KEY=       # from semanticscholar.org/product/api
OLLAMA_BASE_URL=http://localhost:11434
PORT=3001

# frontend/.env
VITE_API_URL=http://localhost:3001
```

## Agents

| Agent | Model tier | Role |
|---|---|---|
| PlannerAgent | Pro (thinking) | Decomposes research goal into queries and concepts |
| RetrieverAgent | Flash-Lite (fast) | Searches Semantic Scholar, fetches citations |
| EmbedderAgent | Ollama local | Chunks paper text, stores embeddings |
| ReasoningAgent | Pro (thinking) | RAG synthesis across all retrieved papers |
| TutorAgent | Pro (thinking) | Answers user questions grounded in paper content |
| ReportAgent | Flash | Generates final structured markdown report |
| OrchestratorAgent | Flash-Lite (fast) | Classifies user intent (doubt / research / report) |

Models are not hardcoded — the registry fetches the live model list at startup and scores each model per role.

## Semantic Scholar API usage

- Endpoints: `/paper/search`, `/paper/{id}`, `/paper/{id}/references`
- Rate: ~150 req/day per session (free tier: 1 req/sec enforced in code)
- Free key at [semanticscholar.org/product/api](https://www.semanticscholar.org/product/api)
