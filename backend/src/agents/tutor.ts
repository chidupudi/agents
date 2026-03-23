import { streamText } from 'ai'
import { getAgentModel } from '../models/registry.js'
import { embedText } from './embedder.js'
import { searchChunks } from '../db/vector.js'

const SYSTEM_PROMPT = `You are a research paper tutor. You help users understand papers they are reading.
Rules:
1. ALWAYS quote the relevant passage from the paper first (format: "From the paper: '...'")
2. Then explain in plain, simple language
3. Use one concrete analogy if the concept is abstract
4. Reference the section if you can identify it (format: [Section X.X])
5. Be concise - if 3 sentences suffice, use 3
6. If paper doesn't cover it, say so and offer to search related papers
7. End with a relevant follow-up question if topic has depth`

export async function runTutor(params: {
  sessionId: string
  question: string
  conversationHistory: Array<{ role: string; content: string }>
  ollamaUrl: string
  onToken: (t: string) => void
  onSectionRef: (section: string, page?: number) => void
}): Promise<void> {
  const queryEmbedding = await embedText(params.question, params.ollamaUrl)

  const chunks = await searchChunks({
    sessionId: params.sessionId,
    queryEmbedding,
    topK: 5
  })

  const contextText = chunks.length > 0
    ? chunks.map((c, i) => `[Source ${i + 1}]:\n${c.text}`).join('\n\n---\n\n')
    : 'No specific paper content available yet.'

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...params.conversationHistory
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    {
      role: 'user',
      content: `Context from papers:\n${contextText}\n\nQuestion: ${params.question}`
    }
  ]

  const { textStream } = streamText({
    model: getAgentModel('tutor'),
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 1024
  })

  for await (const token of textStream) {
    params.onToken(token)

    // Detect section references
    const sectionMatch = token.match(/\[Section\s+(\d+(?:\.\d+)*)\]/g)
    if (sectionMatch) {
      for (const ref of sectionMatch) {
        const sectionNum = ref.replace(/\[Section\s+|\]/g, '')
        params.onSectionRef(sectionNum)
      }
    }
  }
}
