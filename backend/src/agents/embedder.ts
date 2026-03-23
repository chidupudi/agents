import { storeChunk } from '../db/vector.js'
import type { Paper } from '../types.js'
import { v4 as uuidv4 } from 'uuid'

export async function embedText(text: string, ollamaUrl: string): Promise<number[]> {
  try {
    const response = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
    })
    const data = await response.json() as { embedding: number[] }
    return data.embedding
  } catch {
    // Return zero vector if Ollama unavailable
    return new Array(768).fill(0)
  }
}

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize))
    start += chunkSize - overlap
  }
  return chunks
}

export async function embedAndStorePaper(params: {
  paper: Paper
  sessionId: string
  ollamaUrl: string
}): Promise<void> {
  const fullText = `${params.paper.title}\n\nAuthors: ${params.paper.authors.join(', ')}\nYear: ${params.paper.year}\n\n${params.paper.abstract}`
  const chunks = chunkText(fullText)

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i], params.ollamaUrl)
    storeChunk({
      id: uuidv4(),
      sessionId: params.sessionId,
      paperId: params.paper.id,
      chunkIndex: i,
      text: chunks[i],
      embedding
    })
  }
}
