import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { google } from '@ai-sdk/google';
import { v4 } from 'uuid';
import dotenv from 'dotenv';

"use strict";
const BASE_URL = "https://api.semanticscholar.org/graph/v1";
const FIELDS = "paperId,title,year,citationCount,abstract,authors,externalIds,references";
const REF_FIELDS = "paperId,title,year,citationCount,abstract,authors,externalIds";
let lastRequestTime = 0;
async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
  }
  lastRequestTime = Date.now();
}
async function fetchWithRetry(url, headers, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    await rateLimit();
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      const wait = 2e3 * (attempt + 1);
      console.warn(`Semantic Scholar rate limited, waiting ${wait}ms...`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }
    return res;
  }
  throw new Error("Semantic Scholar: max retries exceeded after 429s");
}
function mapToPaper(raw, depth, sessionId) {
  const authors = raw.authors?.map((a) => a.name) ?? [];
  const externalIds = raw.externalIds ?? {};
  return {
    id: v4(),
    semanticScholarId: raw.paperId ?? "",
    title: raw.title ?? "Untitled",
    authors,
    year: raw.year ?? 0,
    abstract: raw.abstract ?? "",
    citationCount: raw.citationCount ?? 0,
    arxivId: externalIds["ArXiv"] ?? void 0,
    doi: externalIds["DOI"] ?? void 0,
    depth,
    relevanceScore: 0,
    status: "fetched",
    sessionId
  };
}
function buildHeaders(apiKey) {
  const headers = {};
  if (apiKey) headers["x-api-key"] = apiKey;
  return headers;
}
async function searchPapers(query, apiKey, sessionId = "") {
  try {
    const url = `${BASE_URL}/paper/search?query=${encodeURIComponent(query)}&fields=${REF_FIELDS}&limit=8`;
    const response = await fetchWithRetry(url, buildHeaders(apiKey));
    if (!response.ok) {
      console.error(`Semantic Scholar search failed: ${response.status} for query: ${query}`);
      return [];
    }
    const data = await response.json();
    return (data.data ?? []).filter((r) => r.paperId && r.title).map((raw) => mapToPaper(raw, 0, sessionId));
  } catch (err) {
    console.error("searchPapers error:", err);
    return [];
  }
}
async function getPaperById(paperId, apiKey, sessionId = "") {
  try {
    const url = `${BASE_URL}/paper/${paperId}?fields=${REF_FIELDS}`;
    const response = await fetchWithRetry(url, buildHeaders(apiKey));
    if (!response.ok) return null;
    const raw = await response.json();
    return mapToPaper(raw, 0, sessionId);
  } catch (err) {
    console.error("getPaperById error:", err);
    return null;
  }
}
async function getPaperWithReferences(paperId, apiKey, sessionId = "") {
  const fallback = {
    paper: {
      id: v4(),
      semanticScholarId: paperId,
      title: "Unknown",
      authors: [],
      year: 0,
      abstract: "",
      citationCount: 0,
      depth: 0,
      relevanceScore: 0,
      status: "fetched",
      sessionId
    },
    references: []
  };
  try {
    const url = `${BASE_URL}/paper/${paperId}?fields=${FIELDS}`;
    const response = await fetchWithRetry(url, buildHeaders(apiKey));
    if (!response.ok) return fallback;
    const raw = await response.json();
    const paper = mapToPaper(raw, 0, sessionId);
    const refs = (raw.references ?? []).filter((r) => r.paperId).map((r) => mapToPaper(r, 1, sessionId));
    return { paper, references: refs };
  } catch (err) {
    console.error("getPaperWithReferences error:", err);
    return fallback;
  }
}

"use strict";
async function getArxivAbstract(arxivId) {
  try {
    const cleanId = arxivId.replace(/^arxiv:/i, "");
    const url = `https://export.arxiv.org/abs/${cleanId}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "AcademicResearchDetective/1.0" }
    });
    if (!response.ok) return "";
    const html = await response.text();
    const abstractMatch = html.match(/<blockquote[^>]*class="[^"]*abstract[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i);
    if (abstractMatch) {
      return abstractMatch[1].replace(/<[^>]+>/g, "").replace(/Abstract:\s*/i, "").trim();
    }
    const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    if (metaMatch) return metaMatch[1].trim();
    return "";
  } catch (err) {
    console.error("getArxivAbstract error:", err);
    return "";
  }
}

"use strict";
async function resolveDOI(doi) {
  try {
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "");
    const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "AcademicResearchDetective/1.0 (mailto:research@example.com)" }
    });
    if (!response.ok) return null;
    const data = await response.json();
    const message = data.message;
    if (!message) return null;
    const titleArr = message.title ?? [];
    const title = titleArr[0] ?? "Unknown Title";
    return { title };
  } catch (err) {
    console.error("resolveDOI error:", err);
    return null;
  }
}

"use strict";
dotenv.config();
function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}
const env = {
  GOOGLE_GENERATIVE_AI_API_KEY: requireEnv("GOOGLE_GENERATIVE_AI_API_KEY"),
  SEMANTIC_SCHOLAR_API_KEY: process.env.SEMANTIC_SCHOLAR_API_KEY || "",
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  PORT: parseInt(process.env.PORT || "3001", 10)
};

"use strict";
const searchPapersTool = createTool({
  id: "search-papers",
  description: "Search for academic papers on Semantic Scholar by keyword or topic query",
  inputSchema: z.object({
    query: z.string().describe("Search query for academic papers")
  }),
  outputSchema: z.object({
    papers: z.array(z.object({
      title: z.string(),
      authors: z.array(z.string()),
      year: z.number(),
      citationCount: z.number(),
      abstract: z.string(),
      semanticScholarId: z.string()
    }))
  }),
  execute: async ({
    context
  }) => {
    const papers = await searchPapers(context.query, env.SEMANTIC_SCHOLAR_API_KEY, "");
    return {
      papers: papers.map((p) => ({
        title: p.title,
        authors: p.authors,
        year: p.year,
        citationCount: p.citationCount,
        abstract: p.abstract,
        semanticScholarId: p.semanticScholarId
      }))
    };
  }
});
const getPaperReferencesTool = createTool({
  id: "get-paper-references",
  description: "Get a paper and all its references (cited papers) from Semantic Scholar",
  inputSchema: z.object({
    paperId: z.string().describe("Semantic Scholar paper ID")
  }),
  outputSchema: z.object({
    paper: z.object({
      title: z.string(),
      year: z.number(),
      abstract: z.string()
    }),
    references: z.array(z.object({
      title: z.string(),
      year: z.number(),
      citationCount: z.number()
    }))
  }),
  execute: async ({
    context
  }) => {
    const result = await getPaperWithReferences(context.paperId, env.SEMANTIC_SCHOLAR_API_KEY, "");
    return {
      paper: {
        title: result.paper.title,
        year: result.paper.year,
        abstract: result.paper.abstract
      },
      references: result.references.map((r) => ({
        title: r.title,
        year: r.year,
        citationCount: r.citationCount
      }))
    };
  }
});
const getArxivAbstractTool = createTool({
  id: "get-arxiv-abstract",
  description: "Fetch the abstract and metadata of a paper from ArXiv using its ArXiv ID",
  inputSchema: z.object({
    arxivId: z.string().describe('ArXiv paper ID, e.g. "1706.03762"')
  }),
  outputSchema: z.object({
    abstract: z.string()
  }),
  execute: async ({
    context
  }) => {
    const abstract = await getArxivAbstract(context.arxivId);
    return {
      abstract
    };
  }
});
const resolveDOITool = createTool({
  id: "resolve-doi",
  description: "Resolve a DOI to paper metadata using CrossRef",
  inputSchema: z.object({
    doi: z.string().describe('Digital Object Identifier, e.g. "10.1145/123456"')
  }),
  outputSchema: z.object({
    title: z.string().optional(),
    semanticScholarId: z.string().optional()
  }),
  execute: async ({
    context
  }) => {
    const result = await resolveDOI(context.doi);
    return result ?? {};
  }
});
const plannerAgent = new Agent({
  id: "plannerAgent",
  name: "PlannerAgent",
  instructions: `You are a research planning agent. Given a research topic or paper content,
you decompose it into a structured research plan with goal concepts, search queries, and priority ordering.
Output ONLY valid JSON with: goalConcepts[], searchQueries[], priorityOrder[], summary.`,
  model: google("gemini-2.5-pro")
});
const retrieverAgent = new Agent({
  id: "retrieverAgent",
  name: "RetrieverAgent",
  instructions: `You are a research retrieval agent. Given search queries,
you use the search-papers tool to find relevant academic papers on Semantic Scholar.
For each important paper, use get-paper-references to find related cited works.
Return structured paper data.`,
  model: google("gemini-2.5-flash-lite"),
  tools: {
    searchPapersTool,
    getPaperReferencesTool,
    getArxivAbstractTool
  }
});
const reasoningAgent = new Agent({
  id: "reasoningAgent",
  name: "ReasoningAgent",
  instructions: `You are a research synthesis agent. Given retrieved paper content and embeddings,
synthesize findings across multiple papers to answer the research goal.
Identify knowledge gaps and concepts needing further exploration.
Be specific and grounded in paper content. End with a gaps JSON block.`,
  model: google("gemini-2.5-pro")
});
const tutorAgent = new Agent({
  id: "tutorAgent",
  name: "TutorAgent",
  instructions: `You are a research paper tutor. Help users understand papers they are reading.
Rules:
1. Always quote the relevant passage from the paper first
2. Explain in plain, simple language
3. Use one concrete analogy if the concept is abstract
4. Reference the section number when identifiable
5. Be concise
6. End with a relevant follow-up question`,
  model: google("gemini-2.5-pro")
});
const reportAgent = new Agent({
  id: "reportAgent",
  name: "ReportAgent",
  instructions: `You are a research report generator. Given synthesized findings and paper summaries,
generate a comprehensive markdown research report with: Overview, Key Concepts, Paper Summaries,
Concept Lineage, Research Gaps, and Conclusion.`,
  model: google("gemini-2.5-flash")
});
const orchestratorAgent = new Agent({
  id: "orchestratorAgent",
  name: "OrchestratorAgent",
  instructions: `You are an intent classifier for an academic research assistant.
Classify user messages into exactly one: "doubt" (asking about paper content),
"report" (wants summary/synthesis), or "research" (wants to find more papers).
Output ONLY one word.`,
  model: google("gemini-2.5-flash-lite")
});
const mastra = new Mastra({
  agents: {
    plannerAgent,
    retrieverAgent,
    reasoningAgent,
    tutorAgent,
    reportAgent,
    orchestratorAgent
  }
});

export { mastra, orchestratorAgent, plannerAgent, reasoningAgent, reportAgent, retrieverAgent, tutorAgent };
