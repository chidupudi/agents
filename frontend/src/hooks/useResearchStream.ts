import { useState, useEffect, useRef, useCallback } from 'react'
import type { AgentStep, Paper, GraphNode, GraphEdge, SSEEvent } from '../types'
import { getStreamUrl } from '../lib/api'

export interface RateLimitEvent {
  id: string
  waitMs: number
  startedAt: number
  attempt: number
  query: string
}

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
  messageDoneCount: number
  rateLimits: RateLimitEvent[]
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
    connected: false,
    messageDoneCount: 0,
    rateLimits: []
  })

  const esRef = useRef<EventSource | null>(null)
  const tokensRef = useRef('')
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const receivedMessageRef = useRef(false)
  const isDoneRef = useRef(false)

  const clearTokens = useCallback(() => {
    console.log('[Stream] clearTokens called — resetting token buffer')
    tokensRef.current = ''
    setState(prev => ({ ...prev, tokens: '' }))
  }, [])

  useEffect(() => {
    if (!sessionId) return

    function connect() {
      if (isDoneRef.current) {
        console.log('[Stream] connect() skipped — isDone=true')
        return
      }

      const url = getStreamUrl(sessionId!)
      console.log('[Stream] Connecting SSE →', url)
      const es = new EventSource(url)
      esRef.current = es

      es.onopen = () => {
        console.log('[Stream] SSE connected')
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
              console.log(`[Stream] agent_step type=${step.type} status=${step.status}`, step.message)
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
              if (tokenData.phase === 'reasoning') {
                console.log(`[Stream] token phase=reasoning SKIPPED (${tokenData.text.length} chars)`)
                break
              }
              if (tokenData.phase === 'welcome') {
                console.log('[Stream] token phase=welcome — RESETTING buffer, starting fresh')
                tokensRef.current = ''
              }
              tokensRef.current += tokenData.text
              const currentTokens = tokensRef.current
              console.log(`[Stream] token phase=${tokenData.phase} +${tokenData.text.length}chars total=${currentTokens.length}chars`)
              setState(prev => ({
                ...prev,
                tokens: currentTokens,
                phase: tokenData.phase || prev.phase
              }))
              break
            }

            case 'paper_found': {
              const paper = parsed.data as Paper
              console.log('[Stream] paper_found:', paper.title)
              setState(prev => {
                if (prev.papers.find(p => p.id === paper.id)) return prev
                return { ...prev, papers: [...prev.papers, paper] }
              })
              break
            }

            case 'graph_update': {
              const graphData = parsed.data as { nodes: GraphNode[]; edges: GraphEdge[] }
              console.log(`[Stream] graph_update nodes=${graphData.nodes?.length} edges=${graphData.edges?.length}`)
              setState(prev => ({
                ...prev,
                graphNodes: graphData.nodes || prev.graphNodes,
                graphEdges: graphData.edges || prev.graphEdges
              }))
              break
            }

            case 'done': {
              console.log('[Stream] done event received — marking isDone=true, keeping SSE alive')
              isDoneRef.current = true
              setState(prev => ({ ...prev, isDone: true }))
              break
            }

            case 'error': {
              const errData = parsed.data as { message: string }
              console.error('[Stream] error event:', errData.message)
              setState(prev => ({ ...prev, error: errData.message || 'An error occurred' }))
              break
            }

            case 'rate_limit': {
              const rl = parsed.data as { waitMs: number; attempt: number; query: string }
              console.warn(`[Stream] rate_limit waitMs=${rl.waitMs} attempt=${rl.attempt} query="${rl.query}"`)
              const event: RateLimitEvent = {
                id: `rl-${Date.now()}-${Math.random()}`,
                waitMs: rl.waitMs,
                startedAt: Date.now(),
                attempt: rl.attempt,
                query: rl.query
              }
              setState(prev => ({ ...prev, rateLimits: [...prev.rateLimits, event] }))
              break
            }

            case 'message_done': {
              console.log(`[Stream] message_done — tokensRef.length=${tokensRef.current.length}, clearing buffer`)
              tokensRef.current = ''
              setState(prev => ({ ...prev, tokens: '', messageDoneCount: prev.messageDoneCount + 1 }))
              break
            }

            default:
              console.log('[Stream] unknown event type:', parsed.type)
          }
        } catch (err) {
          console.error('[Stream] SSE parse error:', err, event.data)
        }
      }

      es.onerror = (err) => {
        console.error('[Stream] SSE error, closing and scheduling reconnect', err)
        es.close()
        esRef.current = null
        setState(prev => ({ ...prev, connected: false }))

        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000)
        retryCountRef.current += 1
        console.log(`[Stream] Reconnect attempt ${retryCountRef.current} in ${delay}ms`)

        if (retryCountRef.current <= 8) {
          retryTimerRef.current = setTimeout(connect, delay)
        } else {
          setState(prev => ({ ...prev, error: 'Could not connect to server after multiple attempts.' }))
        }
      }
    }

    connect()

    return () => {
      console.log('[Stream] Cleanup — closing SSE for session', sessionId)
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
