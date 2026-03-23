# Architecture

## System Components

```mermaid
graph TD
    Browser["Browser :5173"]
    Frontend["Frontend\nReact + Vite"]
    Backend["Backend\nExpress :3001"]
    Mastra["Mastra Dashboard\n:4111"]
    SessionsDB["sessions.db\nLibSQL"]
    VectorsDB["vectors.db\nLibSQL"]
    MastraDB["mastra.db\nLibSQL"]
    Ollama["Ollama\nnomic-embed-text"]
    Gemini["Gemini API\naistudio.google.com"]
    SemanticScholar["Semantic Scholar API"]
    ArXiv["ArXiv API"]
    CrossRef["CrossRef API"]

    Browser -->|HTTP + SSE| Frontend
    Frontend -->|REST + SSE| Backend
    Mastra -->|reads| Backend
    Backend --> SessionsDB
    Backend --> VectorsDB
    Backend --> MastraDB
    Backend -->|embeddings| Ollama
    Backend -->|generateContent| Gemini
    Backend -->|paper search + refs| SemanticScholar
    Backend -->|full text| ArXiv
    Backend -->|DOI resolve| CrossRef
```

---

## Research Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant P as PlannerAgent
    participant R as RetrieverAgent
    participant E as EmbedderAgent
    participant RS as ReasoningAgent
    participant RP as ReportAgent

    U->>FE: Upload PDF / enter topic
    FE->>BE: POST /api/sessions
    FE->>BE: POST /api/sessions/:id/start
    FE->>BE: GET /api/sessions/:id/stream (SSE open)

    BE->>P: runPlanner(input + pdfText)
    P->>Gemini: generateContent (Pro thinking)
    Gemini-->>P: goalConcepts, searchQueries[]
    P-->>BE: plan
    BE-->>FE: SSE agent_step: plan ✓

    loop Per depth level (0 → maxDepth)
        BE->>R: runRetriever(queries[])
        R->>SemanticScholar: GET /paper/search (×2 queries)
        R->>SemanticScholar: GET /paper/:id/references
        SemanticScholar-->>R: papers[]
        R-->>BE: papers[]
        BE-->>FE: SSE paper_found × N

        BE->>E: embedAndStorePaper(papers[])
        E->>Ollama: POST /api/embeddings (nomic-embed-text)
        Ollama-->>E: 768-dim vectors
        E->>VectorsDB: storeChunk()

        BE->>RS: runReasoning(sessionId, goalConcepts)
        RS->>Ollama: embed query
        RS->>VectorsDB: searchChunks (cosine similarity top-10)
        RS->>Gemini: streamText (Pro thinking, RAG context)
        Gemini-->>RS: synthesis + gaps[] (streaming)
        RS-->>FE: SSE token × N (streaming)
        RS-->>BE: gaps[]

        alt gaps found AND depth remaining
            BE->>R: runRetriever(gaps as new queries)
        else
            BE->>RP: runReport()
        end
    end

    BE->>RP: runReport(papers, synthesis)
    RP->>Gemini: streamText (Flash)
    Gemini-->>RP: markdown report (streaming)
    RP-->>FE: SSE token × N
    BE-->>FE: SSE done
```

---

## Q&A / Tutor Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant OA as OrchestratorAgent
    participant TA as TutorAgent

    U->>FE: Type question in chat
    FE->>BE: POST /api/sessions/:id/message
    BE->>OA: detectIntent(message)
    OA->>Gemini: generateContent (Flash-Lite)
    Gemini-->>OA: "doubt" | "research" | "report"

    alt intent = doubt
        BE->>TA: runTutor(question, history)
        TA->>Ollama: embed question
        Ollama-->>TA: query vector
        TA->>VectorsDB: searchChunks top-5
        VectorsDB-->>TA: relevant paper chunks
        TA->>Gemini: streamText (Pro, grounded in chunks)
        Gemini-->>TA: answer (streaming)
        TA-->>FE: SSE token × N
    else intent = research
        BE->>ResearchWorkflow: runResearchWorkflow(message, depth=1)
    else intent = report
        BE->>ReportAgent: runReport()
    end
```

---

## Tool Call Map

```mermaid
graph LR
    subgraph Mastra Tools
        T1["search-papers\nSemantic Scholar /paper/search"]
        T2["get-paper-references\nSemantic Scholar /paper/:id/references"]
        T3["get-arxiv-abstract\nArXiv export API"]
        T4["resolve-doi\nCrossRef /works/:doi"]
    end

    subgraph Agents
        Retriever["RetrieverAgent"]
        Planner["PlannerAgent"]
    end

    Retriever --> T1
    Retriever --> T2
    Retriever --> T3
    Planner -.->|optional DOI input| T4
```

---

## API Call Cost & Weight

```mermaid
graph TD
    subgraph "Per Research Session (depth=2, 2 queries)"
        direction TB

        SS["Semantic Scholar\n~10 calls/depth × 2 depths\n= ~20 calls total\nFree: 1 req/sec enforced"]
        AX["ArXiv\n0–4 calls\n(only when full text needed)\nFree: unlimited"]
        CR["CrossRef\n0–1 calls\n(only for DOI input)\nFree: unlimited"]

        subgraph "Gemini Calls"
            G1["PlannerAgent\n1 call × Pro\n~2K input tokens"]
            G2["ReasoningAgent\n1 call/depth × Pro\n~8K input tokens (RAG context)"]
            G3["ReportAgent\n1 call × Flash\n~4K input tokens"]
            G4["OrchestratorAgent\n1 call/message × Flash-Lite\n~100 input tokens"]
        end

        subgraph "Ollama (local — free)"
            O1["EmbedderAgent\n~5–20 embed calls/paper\nnomic-embed-text"]
            O2["RAG query embed\n1 call per reasoning step"]
        end
    end
```

---

## Model Assignment by Role

```mermaid
graph LR
    subgraph "Model Registry (dynamic — fetched at startup)"
        M1["gemini-2.5-pro\nThinking ✓ | Output 65K\nHigh quality, slower"]
        M2["gemini-2.5-flash\nThinking ✓ | Output 65K\nBalanced speed + quality"]
        M3["gemini-2.5-flash-lite\nThinking ✓ | Output 65K\nFastest, lightest"]
        M4["nomic-embed-text\nLocal Ollama\nFree, 768-dim vectors"]
    end

    subgraph "Agents"
        A1["PlannerAgent\nNeeds: thinking, structured output"]
        A2["RetrieverAgent\nNeeds: fast, tool use"]
        A3["ReasoningAgent\nNeeds: thinking, long context"]
        A4["TutorAgent\nNeeds: thinking, long context"]
        A5["ReportAgent\nNeeds: long output, fast"]
        A6["OrchestratorAgent\nNeeds: fast, intent classify"]
        A7["EmbedderAgent\nNeeds: local, vector output"]
    end

    M1 --> A1
    M3 --> A2
    M1 --> A3
    M1 --> A4
    M2 --> A5
    M3 --> A6
    M4 --> A7
```

---

## Storage Layout

```mermaid
erDiagram
    sessions {
        TEXT id PK
        TEXT input
        TEXT input_type
        TEXT status
        INTEGER max_depth
        TEXT created_at
        TEXT root_paper_id
    }
    papers {
        TEXT id PK
        TEXT semantic_scholar_id
        TEXT session_id FK
        TEXT title
        TEXT authors
        INTEGER year
        TEXT abstract
        INTEGER citation_count
        INTEGER depth
        REAL relevance_score
        TEXT status
    }
    messages {
        TEXT id PK
        TEXT session_id FK
        TEXT role
        TEXT content
        TEXT created_at
    }
    chunks {
        TEXT id PK
        TEXT session_id
        TEXT paper_id
        INTEGER chunk_index
        TEXT text
        TEXT embedding
    }

    sessions ||--o{ papers : "has"
    sessions ||--o{ messages : "has"
    papers ||--o{ chunks : "embedded as"
```

---

## Data Flow: PDF Upload Path

```mermaid
flowchart LR
    PDF["User PDF file"]
    PDFJS["pdfjs-dist\nbrowser extraction"]
    Text["Raw text string\n(up to 8000 chars to planner)"]
    Plan["PlannerAgent\nreads paper content\ngenerates search queries"]
    SS["Semantic Scholar\nfinds related papers"]
    Embed["nomic-embed-text\nembeds full paper chunks"]
    VDB["Vector DB\nsimilarity search for Q&A"]

    PDF --> PDFJS --> Text --> Plan --> SS
    Text --> Embed --> VDB
```
