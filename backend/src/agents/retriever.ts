import { searchPapers } from '../tools/semanticScholar.js'
import { searchArxivPapers } from '../tools/arxiv.js'
import type { Paper } from '../types.js'

export async function runRetriever(
  queries: string[],
  apiKey: string,
  sessionId = '',
  sendEvent?: (type: string, data: unknown) => void
): Promise<Paper[]> {
  const seen = new Set<string>()
  const allPapers: Paper[] = []

  for (const query of queries) {
    // Run Semantic Scholar and ArXiv in parallel — ArXiv has no rate limits and fills gaps fast
    const [ssPapers, arxivPapers] = await Promise.all([
      searchPapers(query, apiKey, sessionId, (waitMs, attempt) => {
        // Emit rate-limit event so the UI can show a countdown
        sendEvent?.('rate_limit', { waitMs, attempt, query })
      }),
      searchArxivPapers(query, sessionId)
    ])

    // Merge: Semantic Scholar first (has citation counts), then ArXiv extras
    for (const paper of [...ssPapers, ...arxivPapers]) {
      if (!seen.has(paper.semanticScholarId)) {
        seen.add(paper.semanticScholarId)
        allPapers.push(paper)
      }
    }
  }

  return allPapers.sort((a, b) => b.citationCount - a.citationCount)
}
