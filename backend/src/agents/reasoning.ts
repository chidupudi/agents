import { streamText } from 'ai'
import { getAgentModel } from '../models/registry.js'
import { embedText } from './embedder.js'
import { searchChunks } from '../db/vector.js'
import type { Paper } from '../types.js'

export async function runReasoning(params: {
  sessionId: string
  goalConcepts: string[]
  papers: Paper[]
  ollamaUrl: string
  onToken: (t: string) => void
}): Promise<{ synthesis: string; gaps: string[]; shouldContinue: boolean }> {
  const queryText = params.goalConcepts.join(', ')
  const queryEmbedding = await embedText(queryText, params.ollamaUrl)

  const chunks = await searchChunks({
    sessionId: params.sessionId,
    queryEmbedding,
    topK: 10
  })

  const contextText = chunks.length > 0
    ? chunks.map((c, i) => `[Chunk ${i + 1} from paper ${c.paperId}]:\n${c.text}`).join('\n\n---\n\n')
    : `Papers available (no embeddings yet): ${params.papers.map(p => p.title).join(', ')}`

  const paperList = params.papers
    .slice(0, 20)
    .map(p => `- "${p.title}" (${p.year}) by ${p.authors.slice(0, 2).join(', ')} - ${p.citationCount} citations`)
    .join('\n')

  const systemPrompt = `You are a research synthesis agent with access to retrieved paper content.
Synthesize what these papers teach about the research goal. After synthesis, identify concept gaps that need further exploration.
Be specific and grounded in the paper content.
End your response with a JSON block like:
\`\`\`gaps
["gap1","gap2"]
\`\`\``

  const userPrompt = `Research Goal: ${queryText}

Papers Found:
${paperList}

Retrieved Content:
${contextText}

Please synthesize the findings and identify gaps.`

  let fullText = ''

  const { textStream } = streamText({
    model: getAgentModel('reasoning'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 2048
  })

  for await (const token of textStream) {
    fullText += token
    params.onToken(token)
  }

  // Parse gaps from response
  let gaps: string[] = []
  const gapsMatch = fullText.match(/```gaps\s*([\s\S]*?)```/)
  if (gapsMatch) {
    try {
      gaps = JSON.parse(gapsMatch[1].trim())
    } catch {
      gaps = []
    }
  }

  return {
    synthesis: fullText,
    gaps,
    shouldContinue: gaps.length > 0
  }
}
