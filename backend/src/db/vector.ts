import { createClient } from '@libsql/client'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { mkdirSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', '..', 'data')
mkdirSync(dataDir, { recursive: true })

const client = createClient({
  url: pathToFileURL(path.join(dataDir, 'vectors.db')).href
})

export async function initVectorDb(): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      paper_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT NOT NULL
    )
  `)
  await client.execute(
    'CREATE INDEX IF NOT EXISTS idx_session ON chunks(session_id)'
  )
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  if (denom === 0) return 0
  return dot / denom
}

export async function storeChunk(params: {
  id: string
  sessionId: string
  paperId: string
  chunkIndex: number
  text: string
  embedding: number[]
}): Promise<void> {
  await client.execute({
    sql: `INSERT OR REPLACE INTO chunks (id, session_id, paper_id, chunk_index, text, embedding)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [params.id, params.sessionId, params.paperId, params.chunkIndex, params.text, JSON.stringify(params.embedding)]
  })
}

export async function searchChunks(params: {
  sessionId: string
  queryEmbedding: number[]
  topK: number
}): Promise<Array<{ paperId: string; text: string; score: number }>> {
  const result = await client.execute({
    sql: 'SELECT paper_id, text, embedding FROM chunks WHERE session_id = ?',
    args: [params.sessionId]
  })

  return result.rows
    .map(row => ({
      paperId: row['paper_id'] as string,
      text: row['text'] as string,
      score: cosineSimilarity(params.queryEmbedding, JSON.parse(row['embedding'] as string))
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, params.topK)
}
