import type { Session, Paper, ChatMessage } from '../types'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

function apiUrl(path: string): string {
  // If BASE_URL ends with /api, don't double it
  if (BASE_URL.endsWith('/api')) {
    return `${BASE_URL}${path}`
  }
  return `${BASE_URL}/api${path}`
}

export async function createSession(
  input: string,
  inputType: string,
  maxDepth: number,
  pdfText?: string
): Promise<Session> {
  const response = await fetch(apiUrl('/sessions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, inputType, maxDepth, pdfText })
  })
  if (!response.ok) throw new Error('Failed to create session')
  return response.json()
}

export async function startResearch(sessionId: string): Promise<void> {
  const response = await fetch(apiUrl(`/sessions/${sessionId}/start`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) throw new Error('Failed to start research')
}

export async function sendMessage(
  sessionId: string,
  message: string
): Promise<{ messageId: string; intent: string }> {
  const response = await fetch(apiUrl(`/sessions/${sessionId}/message`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  })
  if (!response.ok) throw new Error('Failed to send message')
  return response.json()
}

export async function getPapers(sessionId: string): Promise<Paper[]> {
  const response = await fetch(apiUrl(`/sessions/${sessionId}/papers`))
  if (!response.ok) return []
  return response.json()
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const response = await fetch(apiUrl(`/sessions/${sessionId}/messages`))
  if (!response.ok) return []
  return response.json()
}

export async function getSessions(): Promise<Session[]> {
  const response = await fetch(apiUrl('/sessions'))
  if (!response.ok) return []
  return response.json()
}

export async function getReport(sessionId: string): Promise<{ markdown: string }> {
  const response = await fetch(apiUrl(`/sessions/${sessionId}/report`))
  if (!response.ok) return { markdown: '' }
  return response.json()
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const response = await fetch(apiUrl(`/sessions/${sessionId}`))
  if (!response.ok) return null
  return response.json()
}

export function getStreamUrl(sessionId: string): string {
  const base = import.meta.env.VITE_API_URL || ''
  if (base) {
    return `${base}/api/sessions/${sessionId}/stream`
  }
  return `/api/sessions/${sessionId}/stream`
}

export async function getModels(): Promise<Record<string, unknown>> {
  const response = await fetch(apiUrl('/models'))
  if (!response.ok) return {}
  return response.json()
}
