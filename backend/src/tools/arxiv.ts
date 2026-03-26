import type { Paper } from '../types.js'
import { v4 as uuidv4 } from 'uuid'

function parseAtomEntries(xml: string, sessionId: string): Paper[] {
  const entries = xml.split(/<entry>/).slice(1)
  return entries.flatMap(entry => {
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
    const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
    const rawId = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() ?? ''
    const arxivId = rawId.replace(/^.*arxiv\.org\/abs\//, '').replace(/v\d+$/, '')
    const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map(m => m[1].trim())
    const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() ?? ''
    const year = published ? new Date(published).getFullYear() : 0
    if (!title || !arxivId) return []
    return [{
      id: uuidv4(),
      semanticScholarId: `arxiv-${arxivId}`,
      title,
      authors,
      year,
      abstract: summary,
      citationCount: 0,
      arxivId,
      depth: 0,
      relevanceScore: 0,
      status: 'fetched' as const,
      sessionId
    } satisfies Paper]
  })
}

export async function searchArxivPapers(query: string, sessionId = ''): Promise<Paper[]> {
  try {
    const q = encodeURIComponent(`all:${query}`)
    const url = `https://export.arxiv.org/api/query?search_query=${q}&start=0&max_results=8&sortBy=relevance`
    const res = await fetch(url, { headers: { 'User-Agent': 'AcademicResearchDetective/1.0' } })
    if (!res.ok) return []
    const xml = await res.text()
    return parseAtomEntries(xml, sessionId)
  } catch (err) {
    console.error('searchArxivPapers error:', err)
    return []
  }
}

export async function getArxivAbstract(arxivId: string): Promise<string> {
  try {
    const cleanId = arxivId.replace(/^arxiv:/i, '')
    const url = `https://export.arxiv.org/abs/${cleanId}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AcademicResearchDetective/1.0' }
    })
    if (!response.ok) return ''

    const html = await response.text()

    // Extract abstract from the HTML
    const abstractMatch = html.match(/<blockquote[^>]*class="[^"]*abstract[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i)
    if (abstractMatch) {
      return abstractMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/Abstract:\s*/i, '')
        .trim()
    }

    // Fallback: try meta description
    const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
    if (metaMatch) return metaMatch[1].trim()

    return ''
  } catch (err) {
    console.error('getArxivAbstract error:', err)
    return ''
  }
}
