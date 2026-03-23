import type { Paper } from '../types.js'
import { v4 as uuidv4 } from 'uuid'

const BASE_URL = 'https://api.semanticscholar.org/graph/v1'
const FIELDS = 'paperId,title,year,citationCount,abstract,authors,externalIds,references'
const REF_FIELDS = 'paperId,title,year,citationCount,abstract,authors,externalIds'

// Free tier: 1 request/second — enforce globally
let lastRequestTime = 0
async function rateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < 1100) {
    await new Promise(resolve => setTimeout(resolve, 1100 - elapsed))
  }
  lastRequestTime = Date.now()
}

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    await rateLimit()
    const res = await fetch(url, { headers })
    if (res.status === 429) {
      const wait = 2000 * (attempt + 1)
      console.warn(`Semantic Scholar rate limited, waiting ${wait}ms...`)
      await new Promise(resolve => setTimeout(resolve, wait))
      continue
    }
    return res
  }
  throw new Error('Semantic Scholar: max retries exceeded after 429s')
}

function mapToPaper(raw: Record<string, unknown>, depth: number, sessionId: string): Paper {
  const authors = (raw.authors as Array<{ name: string }> | undefined)?.map(a => a.name) ?? []
  const externalIds = (raw.externalIds as Record<string, string> | undefined) ?? {}
  return {
    id: uuidv4(),
    semanticScholarId: (raw.paperId as string) ?? '',
    title: (raw.title as string) ?? 'Untitled',
    authors,
    year: (raw.year as number) ?? 0,
    abstract: (raw.abstract as string) ?? '',
    citationCount: (raw.citationCount as number) ?? 0,
    arxivId: externalIds['ArXiv'] ?? undefined,
    doi: externalIds['DOI'] ?? undefined,
    depth,
    relevanceScore: 0,
    status: 'fetched',
    sessionId
  }
}

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (apiKey) headers['x-api-key'] = apiKey
  return headers
}

export async function searchPapers(query: string, apiKey: string, sessionId = ''): Promise<Paper[]> {
  try {
    const url = `${BASE_URL}/paper/search?query=${encodeURIComponent(query)}&fields=${REF_FIELDS}&limit=8`
    const response = await fetchWithRetry(url, buildHeaders(apiKey))
    if (!response.ok) {
      console.error(`Semantic Scholar search failed: ${response.status} for query: ${query}`)
      return []
    }
    const data = await response.json() as { data?: Record<string, unknown>[] }
    return (data.data ?? []).filter(r => r.paperId && r.title).map(raw => mapToPaper(raw, 0, sessionId))
  } catch (err) {
    console.error('searchPapers error:', err)
    return []
  }
}

export async function getPaperById(paperId: string, apiKey: string, sessionId = ''): Promise<Paper | null> {
  try {
    const url = `${BASE_URL}/paper/${paperId}?fields=${REF_FIELDS}`
    const response = await fetchWithRetry(url, buildHeaders(apiKey))
    if (!response.ok) return null
    const raw = await response.json() as Record<string, unknown>
    return mapToPaper(raw, 0, sessionId)
  } catch (err) {
    console.error('getPaperById error:', err)
    return null
  }
}

export async function getPaperWithReferences(
  paperId: string,
  apiKey: string,
  sessionId = ''
): Promise<{ paper: Paper; references: Paper[] }> {
  const fallback = {
    paper: {
      id: uuidv4(), semanticScholarId: paperId, title: 'Unknown',
      authors: [], year: 0, abstract: '', citationCount: 0,
      depth: 0, relevanceScore: 0, status: 'fetched' as const, sessionId
    },
    references: []
  }
  try {
    const url = `${BASE_URL}/paper/${paperId}?fields=${FIELDS}`
    const response = await fetchWithRetry(url, buildHeaders(apiKey))
    if (!response.ok) return fallback

    const raw = await response.json() as Record<string, unknown>
    const paper = mapToPaper(raw, 0, sessionId)
    const refs = ((raw.references as Array<Record<string, unknown>> | undefined) ?? [])
      .filter(r => r.paperId)
      .map(r => mapToPaper(r, 1, sessionId))

    return { paper, references: refs }
  } catch (err) {
    console.error('getPaperWithReferences error:', err)
    return fallback
  }
}
