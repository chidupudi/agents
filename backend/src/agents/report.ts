import { streamText } from 'ai'
import { getAgentModel } from '../models/registry.js'
import type { Paper, GraphNode, GraphEdge } from '../types.js'

export async function runReport(params: {
  sessionId: string
  papers: Paper[]
  synthesis: string
  goalConcepts: string[]
  onToken: (t: string) => void
}): Promise<{ reportMarkdown: string; graphData: { nodes: GraphNode[]; edges: GraphEdge[] } }> {
  const paperSummaries = params.papers
    .slice(0, 30)
    .map(p => `- **${p.title}** (${p.year}) by ${p.authors.slice(0, 3).join(', ')}
  - Citations: ${p.citationCount} | Relevance: ${(p.relevanceScore * 100).toFixed(0)}%
  - ${p.abstract ? p.abstract.slice(0, 200) + '...' : 'No abstract available'}`)
    .join('\n\n')

  const prompt = `Create a comprehensive research report in markdown format about: ${params.goalConcepts.join(', ')}

Previous synthesis:
${params.synthesis.slice(0, 1000)}

Papers found (${params.papers.length} total):
${paperSummaries}

Format the report exactly as:
# Research Report: [Topic Title]

## Overview
[2-3 paragraph overview of the research landscape]

## Key Concepts Discovered
[Bullet list of main concepts with brief explanations]

## Paper Summaries
[For each major paper: title, authors, year, key contribution, why it matters]

## Concept Lineage
[How ideas build on each other, intellectual genealogy]

## Research Gaps
[What remains unexplored based on the literature]

## Conclusion
[Summary of findings and recommended next steps]`

  let reportMarkdown = ''

  const { textStream } = streamText({
    model: getAgentModel('report'),
    prompt,
    maxTokens: 4096
  })

  for await (const token of textStream) {
    reportMarkdown += token
    params.onToken(token)
  }

  // Build graph data from papers
  const nodes: GraphNode[] = params.papers.map(p => ({
    id: p.id,
    title: p.title,
    year: p.year,
    citationCount: p.citationCount,
    relevanceScore: p.relevanceScore,
    depth: p.depth,
    status: p.status
  }))

  // Create edges from depth relationships (depth 0 -> depth 1 papers)
  const edges: GraphEdge[] = []
  const depth0Papers = params.papers.filter(p => p.depth === 0)
  const depth1Papers = params.papers.filter(p => p.depth === 1)

  for (const root of depth0Papers) {
    for (const ref of depth1Papers.slice(0, 5)) {
      edges.push({ source: root.id, target: ref.id })
    }
  }

  return { reportMarkdown, graphData: { nodes, edges } }
}
