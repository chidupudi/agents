export interface Paper {
  id: string
  semanticScholarId: string
  title: string
  authors: string[]
  year: number
  abstract: string
  citationCount: number
  arxivId?: string
  doi?: string
  depth: number
  relevanceScore: number
  status: 'fetched' | 'queued' | 'skipped' | 'root'
  sessionId: string
}

export interface Session {
  id: string
  input: string
  inputType: 'topic' | 'doi' | 'url' | 'pdf'
  status: 'running' | 'completed' | 'error'
  maxDepth: number
  createdAt: string
  rootPaperId?: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface AgentStep {
  type: 'plan' | 'fetch' | 'embed' | 'reason' | 'tutor' | 'report'
  status: 'running' | 'done' | 'error'
  message: string
  data?: Record<string, unknown>
}

export interface SSEEvent {
  type: 'agent_step' | 'token' | 'paper_found' | 'graph_update' | 'done' | 'error'
  data: unknown
}

export interface GraphNode {
  id: string
  title: string
  year: number
  citationCount: number
  relevanceScore: number
  depth: number
  status: Paper['status']
}

export interface GraphEdge {
  source: string
  target: string
}
