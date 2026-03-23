import { useState, useEffect, useRef, useCallback } from 'react'
import type { AgentStep, Paper, GraphNode, GraphEdge, SSEEvent } from '../types'
import { getStreamUrl } from '../lib/api'

interface StreamState {
  tokens: string
  agentSteps: AgentStep[]
  papers: Paper[]
  graphNodes: GraphNode[]
  graphEdges: GraphEdge[]
  isDone: boolean
  error: string | null
  phase: string
  connected: boolean
}

interface UseResearchStreamReturn extends StreamState {
  clearTokens: () => void
}

export function useResearchStream(sessionId: string | null): UseResearchStreamReturn {
  const [state, setState] = useState<StreamState>({
    tokens: '',
    agentSteps: [],
    papers: [],
    graphNodes: [],
    graphEdges: [],
    isDone: false,
    error: null,
    phase: '',
    connected: false
  })

  const esRef = useRef<EventSource | null>(null)
  const tokensRef = useRef('')
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const receivedMessageRef = useRef(false)
  const isDoneRef = useRef(false)

  const clearTokens = useCallback(() => {
    tokensRef.current = ''
    setState(prev => ({ ...prev, tokens: '' }))
  }, [])

  useEffect(() => {
    if (!sessionId) return

    function connect() {
      if (isDoneRef.current) return

      const url = getStreamUrl(sessionId!)
      const es = new EventSource(url)
      esRef.current = es

      es.onopen = () => {
        retryCountRef.current = 0
        setState(prev => ({ ...prev, connected: true, error: null }))
      }

      es.onmessage = (event) => {
        receivedMessageRef.current = true
        try {
          const parsed = JSON.parse(event.data) as SSEEvent

          switch (parsed.type) {
            case 'agent_step': {
              const step = parsed.data as AgentStep
              setState(prev => {
                const existingIdx = prev.agentSteps.findIndex(
                  s => s.type === step.type && s.status === 'running'
                )
                if (existingIdx >= 0) {
                  const updated = [...prev.agentSteps]
                  updated[existingIdx] = step
                  return { ...prev, agentSteps: updated }
                }
                return { ...prev, agentSteps: [...prev.agentSteps, step] }
              })
              break
            }

            case 'token': {
              const tokenData = parsed.data as { text: string; phase?: string }
              tokensRef.current += tokenData.text
              const currentTokens = tokensRef.current
              setState(prev => ({
                ...prev,
                tokens: currentTokens,
                phase: tokenData.phase || prev.phase
              }))
              break
            }

            case 'paper_found': {
              const paper = parsed.data as Paper
              setState(prev => {
                if (prev.papers.find(p => p.id === paper.id)) return prev
                return { ...prev, papers: [...prev.papers, paper] }
              })
              break
            }

            case 'graph_update': {
              const graphData = parsed.data as { nodes: GraphNode[]; edges: GraphEdge[] }
              setState(prev => ({
                ...prev,
                graphNodes: graphData.nodes || prev.graphNodes,
                graphEdges: graphData.edges || prev.graphEdges
              }))
              break
            }

            case 'done': {
              isDoneRef.current = true
              setState(prev => ({ ...prev, isDone: true }))
              es.close()
              break
            }

            case 'error': {
              const errData = parsed.data as { message: string }
              setState(prev => ({ ...prev, error: errData.message || 'An error occurred' }))
              break
            }

            case 'message_done': {
              tokensRef.current = ''
              setState(prev => ({ ...prev, tokens: '' }))
              break
            }
          }
        } catch (err) {
          console.error('SSE parse error:', err)
        }
      }

      es.onerror = () => {
        es.close()
        esRef.current = null
        setState(prev => ({ ...prev, connected: false }))

        if (isDoneRef.current) return

        // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000)
        retryCountRef.current += 1

        if (retryCountRef.current <= 8) {
          retryTimerRef.current = setTimeout(connect, delay)
        } else {
          setState(prev => ({ ...prev, error: 'Could not connect to server after multiple attempts.' }))
        }
      }
    }

    connect()

    return () => {
      isDoneRef.current = false
      receivedMessageRef.current = false
      retryCountRef.current = 0
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      esRef.current?.close()
      esRef.current = null
    }
  }, [sessionId])

  return { ...state, clearTokens }
}
