import { searchPapers } from '../tools/semanticScholar.js'
import type { Paper } from '../types.js'

export async function runRetriever(queries: string[], apiKey: string, sessionId = ''): Promise<Paper[]> {
  const allPapers: Paper[] = []
  const seen = new Set<string>()

  for (const query of queries) {
    const papers = await searchPapers(query, apiKey, sessionId)
    for (const paper of papers) {
      if (!seen.has(paper.semanticScholarId)) {
        seen.add(paper.semanticScholarId)
        allPapers.push(paper)
      }
    }
  }

  return allPapers.sort((a, b) => b.citationCount - a.citationCount)
}
