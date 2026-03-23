import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core/agent'
import { createTool } from '@mastra/core/tools'
import { LibSQLStore } from '@mastra/libsql'
import { z } from 'zod/v3'
import { google } from '@ai-sdk/google'
import path from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', '..', 'data')
mkdirSync(dataDir, { recursive: true })
import { searchPapers, getPaperWithReferences } from '../tools/semanticScholar.js'
import { getArxivAbstract } from '../tools/arxiv.js'
import { resolveDOI } from '../tools/crossref.js'
import { env } from '../env.js'

// ─── Tools ───────────────────────────────────────────────────────────────────

const searchPapersTool = createTool({
  id: 'search-papers',
  description: 'Search for academic papers on Semantic Scholar by keyword or topic query',
  inputSchema: z.object({
    query: z.string().describe('Search query for academic papers')
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
  execute: async ({ context }) => {
    const papers = await searchPapers(context.query, env.SEMANTIC_SCHOLAR_API_KEY, '')
    return {
      papers: papers.map(p => ({
        title: p.title,
        authors: p.authors,
        year: p.year,
        citationCount: p.citationCount,
        abstract: p.abstract,
        semanticScholarId: p.semanticScholarId
      }))
    }
  }
})

const getPaperReferencesTool = createTool({
  id: 'get-paper-references',
  description: 'Get a paper and all its references (cited papers) from Semantic Scholar',
  inputSchema: z.object({
    paperId: z.string().describe('Semantic Scholar paper ID')
  }),
  outputSchema: z.object({
    paper: z.object({ title: z.string(), year: z.number(), abstract: z.string() }),
    references: z.array(z.object({ title: z.string(), year: z.number(), citationCount: z.number() }))
  }),
  execute: async ({ context }) => {
    const result = await getPaperWithReferences(context.paperId, env.SEMANTIC_SCHOLAR_API_KEY, '')
    return {
      paper: { title: result.paper.title, year: result.paper.year, abstract: result.paper.abstract },
      references: result.references.map(r => ({ title: r.title, year: r.year, citationCount: r.citationCount }))
    }
  }
})

const getArxivAbstractTool = createTool({
  id: 'get-arxiv-abstract',
  description: 'Fetch the abstract and metadata of a paper from ArXiv using its ArXiv ID',
  inputSchema: z.object({
    arxivId: z.string().describe('ArXiv paper ID, e.g. "1706.03762"')
  }),
  outputSchema: z.object({ abstract: z.string() }),
  execute: async ({ context }) => {
    const abstract = await getArxivAbstract(context.arxivId)
    return { abstract }
  }
})

const resolveDOITool = createTool({
  id: 'resolve-doi',
  description: 'Resolve a DOI to paper metadata using CrossRef',
  inputSchema: z.object({
    doi: z.string().describe('Digital Object Identifier, e.g. "10.1145/123456"')
  }),
  outputSchema: z.object({
    title: z.string().optional(),
    semanticScholarId: z.string().optional()
  }),
  execute: async ({ context }) => {
    const result = await resolveDOI(context.doi)
    return result ?? {}
  }
})

// ─── Agents ──────────────────────────────────────────────────────────────────

export const plannerAgent = new Agent({
  id: 'plannerAgent',
  name: 'PlannerAgent',
  instructions: `You are a research planning agent. Given a research topic or paper content,
you decompose it into a structured research plan with goal concepts, search queries, and priority ordering.
Output ONLY valid JSON with: goalConcepts[], searchQueries[], priorityOrder[], summary.`,
  model: google('gemini-2.5-pro'),
})

export const retrieverAgent = new Agent({
  id: 'retrieverAgent',
  name: 'RetrieverAgent',
  instructions: `You are a research retrieval agent. Given search queries,
you use the search-papers tool to find relevant academic papers on Semantic Scholar.
For each important paper, use get-paper-references to find related cited works.
Return structured paper data.`,
  model: google('gemini-2.5-flash-lite'),
  tools: { searchPapersTool, getPaperReferencesTool, getArxivAbstractTool }
})

export const reasoningAgent = new Agent({
  id: 'reasoningAgent',
  name: 'ReasoningAgent',
  instructions: `You are a research synthesis agent. Given retrieved paper content and embeddings,
synthesize findings across multiple papers to answer the research goal.
Identify knowledge gaps and concepts needing further exploration.
Be specific and grounded in paper content. End with a gaps JSON block.`,
  model: google('gemini-2.5-pro'),
})

export const tutorAgent = new Agent({
  id: 'tutorAgent',
  name: 'TutorAgent',
  instructions: `You are a research paper tutor. Help users understand papers they are reading.
Rules:
1. Always quote the relevant passage from the paper first
2. Explain in plain, simple language
3. Use one concrete analogy if the concept is abstract
4. Reference the section number when identifiable
5. Be concise
6. End with a relevant follow-up question`,
  model: google('gemini-2.5-pro'),
})

export const reportAgent = new Agent({
  id: 'reportAgent',
  name: 'ReportAgent',
  instructions: `You are a research report generator. Given synthesized findings and paper summaries,
generate a comprehensive markdown research report with: Overview, Key Concepts, Paper Summaries,
Concept Lineage, Research Gaps, and Conclusion.`,
  model: google('gemini-2.5-flash'),
})

export const orchestratorAgent = new Agent({
  id: 'orchestratorAgent',
  name: 'OrchestratorAgent',
  instructions: `You are an intent classifier for an academic research assistant.
Classify user messages into exactly one: "doubt" (asking about paper content),
"report" (wants summary/synthesis), or "research" (wants to find more papers).
Output ONLY one word.`,
  model: google('gemini-2.5-flash-lite'),
})

// ─── Mastra Instance ─────────────────────────────────────────────────────────

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: `file:${path.join(dataDir, 'mastra.db')}`
  }),
  agents: {
    plannerAgent,
    retrieverAgent,
    reasoningAgent,
    tutorAgent,
    reportAgent,
    orchestratorAgent
  }
})
