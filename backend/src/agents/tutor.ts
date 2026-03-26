import { streamText } from 'ai'
import { getAgentModel } from '../models/registry.js'
import { embedText } from './embedder.js'
import { searchChunks } from '../db/vector.js'

export async function runChat(params: {
  message: string
  conversationHistory: Array<{ role: string; content: string }>
  hasPapers: boolean
  onToken: (t: string) => void
}): Promise<void> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...params.conversationHistory
      .slice(-6)
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: params.message }
  ]

  const { textStream } = streamText({
    model: getAgentModel('tutor'),
    system: `You are a friendly academic research assistant. Respond naturally and warmly.
${params.hasPapers
  ? 'Papers are loaded in this session. Remind the user they can ask about concepts in the papers, request a full report, or search for more related work.'
  : 'No papers loaded yet. Once research runs, you can answer questions about the papers, generate reports, or explore related topics.'}
Keep it brief and conversational.`,
    messages,
    maxTokens: 250
  })

  for await (const token of textStream) {
    params.onToken(token)
  }
}

const SYSTEM_PROMPT = `You are an expert research analyst with deep knowledge across scientific domains.
Your role is to give rich, insightful answers grounded in the loaded research papers.

## How to answer:
1. **Synthesize across multiple papers** — don't just quote one source. Find patterns, agreements, and contrasts across sources.
2. **Use real-world context** — connect findings to actual companies, industries, products, or applications the user would recognize.
3. **Structure clearly** — use markdown: ## headers for sections, **bold** for key terms, bullet points for lists, > blockquotes for important passages.
4. **Cite properly** — use inline citations like *(AuthorLastName et al., Year)* or *[Paper Title]* after each claim.
5. **Go beyond surface level** — explain WHY it matters, HOW it works mechanically, and WHERE it's actively being applied.
6. **Quote judiciously** — use blockquotes (>) for genuinely important passages, not every sentence.
7. **End with a forward-looking note** — one concrete next direction, related question, or unexplored angle.

Write like a domain expert explaining to a curious, intelligent colleague. Be comprehensive but scannable.
Minimum 3 distinct insights per answer. Use all relevant sources available.`

export async function runTutor(params: {
  sessionId: string
  question: string
  conversationHistory: Array<{ role: string; content: string }>
  papers: Array<{ id: string; title: string; authors: string[]; year: number }>
  ollamaUrl: string
  onToken: (t: string) => void
  onSectionRef: (section: string, page?: number) => void
}): Promise<void> {
  const queryEmbedding = await embedText(params.question, params.ollamaUrl)

  // Get more chunks for richer context
  const chunks = await searchChunks({
    sessionId: params.sessionId,
    queryEmbedding,
    topK: 14
  })

  // Build a paper lookup map so chunks can be labelled with real titles + authors
  const paperMap = new Map(params.papers.map(p => [p.id, p]))

  const contextText = chunks.length > 0
    ? chunks.map((c, i) => {
        const paper = paperMap.get(c.paperId)
        const citation = paper
          ? `"${paper.title}" (${paper.authors.slice(0, 2).join(', ')}${paper.authors.length > 2 ? ' et al.' : ''}, ${paper.year})`
          : `Source ${i + 1}`
        return `[${citation}]:\n${c.text}`
      }).join('\n\n---\n\n')
    : 'No paper content indexed yet. Answer based on general knowledge and note that papers are not yet available.'

  // Trim conversation history to last 6 exchanges to stay focused
  const history = params.conversationHistory
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-12)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const userMessage = `## Research Context (${chunks.length} relevant passages from ${params.papers.length} papers):

${contextText}

---

## Question:
${params.question}

Please give a comprehensive, well-structured answer using the research context above. Cite the papers inline.`

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history,
    { role: 'user', content: userMessage }
  ]

  const { textStream } = streamText({
    model: getAgentModel('tutor'),
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 2048
  })

  for await (const token of textStream) {
    params.onToken(token)

    const sectionMatch = token.match(/\[Section\s+(\d+(?:\.\d+)*)\]/g)
    if (sectionMatch) {
      for (const ref of sectionMatch) {
        const sectionNum = ref.replace(/\[Section\s+|\]/g, '')
        params.onSectionRef(sectionNum)
      }
    }
  }
}
