import { createClient } from '@libsql/client'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { mkdirSync } from 'fs'
import type { Session, Paper, ChatMessage } from '../types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', '..', 'data')
mkdirSync(dataDir, { recursive: true })

const client = createClient({
  url: pathToFileURL(path.join(dataDir, 'sessions.db')).href
})

export async function initSessionsDb(): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      input TEXT NOT NULL,
      input_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      max_depth INTEGER NOT NULL DEFAULT 2,
      created_at TEXT NOT NULL,
      root_paper_id TEXT
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      semantic_scholar_id TEXT,
      session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      authors TEXT NOT NULL,
      year INTEGER,
      abstract TEXT,
      citation_count INTEGER DEFAULT 0,
      arxiv_id TEXT,
      doi TEXT,
      depth INTEGER NOT NULL DEFAULT 0,
      relevance_score REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued'
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
}

export async function createSession(session: Session): Promise<void> {
  await client.execute({
    sql: `INSERT INTO sessions (id, input, input_type, status, max_depth, created_at, root_paper_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [session.id, session.input, session.inputType, session.status, session.maxDepth, session.createdAt, session.rootPaperId ?? null]
  })
}

export async function getSession(id: string): Promise<Session | null> {
  const result = await client.execute({ sql: 'SELECT * FROM sessions WHERE id = ?', args: [id] })
  const row = result.rows[0]
  if (!row) return null
  return {
    id: row['id'] as string,
    input: row['input'] as string,
    inputType: row['input_type'] as Session['inputType'],
    status: row['status'] as Session['status'],
    maxDepth: row['max_depth'] as number,
    createdAt: row['created_at'] as string,
    rootPaperId: row['root_paper_id'] as string | undefined
  }
}

export async function getAllSessions(): Promise<Session[]> {
  const result = await client.execute('SELECT * FROM sessions ORDER BY created_at DESC')
  return result.rows.map(row => ({
    id: row['id'] as string,
    input: row['input'] as string,
    inputType: row['input_type'] as Session['inputType'],
    status: row['status'] as Session['status'],
    maxDepth: row['max_depth'] as number,
    createdAt: row['created_at'] as string,
    rootPaperId: row['root_paper_id'] as string | undefined
  }))
}

export async function updateSessionStatus(id: string, status: Session['status']): Promise<void> {
  await client.execute({ sql: 'UPDATE sessions SET status = ? WHERE id = ?', args: [status, id] })
}

export async function savePaper(paper: Paper): Promise<void> {
  await client.execute({
    sql: `INSERT OR REPLACE INTO papers
          (id, semantic_scholar_id, session_id, title, authors, year, abstract, citation_count, arxiv_id, doi, depth, relevance_score, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      paper.id, paper.semanticScholarId, paper.sessionId,
      paper.title, JSON.stringify(paper.authors), paper.year,
      paper.abstract, paper.citationCount, paper.arxivId ?? null,
      paper.doi ?? null, paper.depth, paper.relevanceScore, paper.status
    ]
  })
}

export async function getPapersForSession(sessionId: string): Promise<Paper[]> {
  const result = await client.execute({
    sql: 'SELECT * FROM papers WHERE session_id = ? ORDER BY depth, relevance_score DESC',
    args: [sessionId]
  })
  return result.rows.map(row => ({
    id: row['id'] as string,
    semanticScholarId: row['semantic_scholar_id'] as string,
    title: row['title'] as string,
    authors: JSON.parse(row['authors'] as string),
    year: row['year'] as number,
    abstract: row['abstract'] as string,
    citationCount: row['citation_count'] as number,
    arxivId: row['arxiv_id'] as string | undefined,
    doi: row['doi'] as string | undefined,
    depth: row['depth'] as number,
    relevanceScore: row['relevance_score'] as number,
    status: row['status'] as Paper['status'],
    sessionId: row['session_id'] as string
  }))
}

export async function saveMessage(message: ChatMessage): Promise<void> {
  await client.execute({
    sql: `INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [message.id, message.sessionId, message.role, message.content, message.createdAt]
  })
}

export async function getMessagesForSession(sessionId: string): Promise<ChatMessage[]> {
  const result = await client.execute({
    sql: 'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
    args: [sessionId]
  })
  return result.rows.map(row => ({
    id: row['id'] as string,
    sessionId: row['session_id'] as string,
    role: row['role'] as 'user' | 'assistant',
    content: row['content'] as string,
    createdAt: row['created_at'] as string
  }))
}
