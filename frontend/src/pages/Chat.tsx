import { useState, useEffect, useRef } from 'react'
import { useParams, useOutletContext, useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useResearchStream } from '../hooks/useResearchStream'
import { startResearch, sendMessage as apiSendMessage, getSession, getMessages, getPapers } from '../lib/api'
import type { ChatMessage, Paper } from '../types'
import AgentBubble from '../components/AgentBubble'
import RateLimitBubble from '../components/RateLimitBubble'
import PapersSidebar from '../components/PapersSidebar'
import SettingsPanel from '../components/SettingsPanel'
import ChatInput from '../components/ChatInput'

interface OutletCtx {
  refreshSessions: () => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}

interface PriorMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// Typing dots indicator
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#94a3b8',
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
        }} />
      ))}
    </div>
  )
}

// Left-side assistant bubble wrapper
function AssistantBubble({ children, streaming }: { children: React.ReactNode; streaming?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, animation: 'fadeInUp 150ms ease' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: '#eff6ff', border: '1px solid #bfdbfe',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.85rem', flexShrink: 0, marginTop: 2
      }}>
        🔬
      </div>
      <div style={{
        maxWidth: '82%',
        background: '#ffffff',
        border: `1px solid ${streaming ? '#bfdbfe' : '#e2e8f0'}`,
        borderRadius: '4px 16px 16px 16px',
        padding: '12px 16px',
        fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.65,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {children}
      </div>
    </div>
  )
}

// Right-side user bubble
function UserBubble({ content }: { content: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'fadeInUp 150ms ease' }}>
      <div style={{
        maxWidth: '75%',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '16px 16px 4px 16px',
        padding: '10px 14px',
        fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.6
      }}>
        {content}
      </div>
    </div>
  )
}

export default function Chat() {
  const { id } = useParams<{ id: string }>()
  const ctx = useOutletContext<OutletCtx>()
  const location = useLocation()
  const priorMessages: PriorMessage[] = (location.state as { priorMessages?: PriorMessage[] })?.priorMessages ?? []

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionInput, setSessionInput] = useState('')
  const [sessionStatus, setSessionStatus] = useState('running')
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [papersOpen, setPapersOpen] = useState(false)
  const [depth, setDepth] = useState(2)
  const [loadedPapers, setLoadedPapers] = useState<Paper[]>([])

  const started = useRef(false)
  const prevIdRef = useRef<string | undefined>(undefined)
  const streamingTextRef = useRef('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const stream = useResearchStream(id || null)

  useEffect(() => {
    if (!id) return
    if (prevIdRef.current === id) return
    prevIdRef.current = id

    setMessages([])
    setSessionInput('')
    setSessionStatus('running')
    setStreamingText('')
    setIsStreaming(false)
    setLoadedPapers([])
    streamingTextRef.current = ''
    started.current = false

    async function init() {
      console.log('[Chat] init() start for session', id)
      try {
        const [session, msgs, papers] = await Promise.all([
          getSession(id!),
          getMessages(id!),
          getPapers(id!)
        ])
        console.log(`[Chat] init() loaded: session=${!!session} msgs=${msgs.length} papers=${papers.length}`)
        if (session) {
          setSessionInput(session.input)
          setSessionStatus(session.status)
          if (session.maxDepth) setDepth(session.maxDepth)
        }
        if (msgs.length > 0) setMessages(msgs)
        if (papers.length > 0) setLoadedPapers(papers)

        if (!started.current) {
          started.current = true
          if (msgs.length === 0) {
            console.log('[Chat] No existing messages — calling startResearch()')
            await startResearch(id!)
          } else {
            console.log('[Chat] Existing messages found — skipping startResearch()')
          }
        }
      } catch (err) {
        console.error('[Chat] init() error:', err)
        if (!started.current) {
          started.current = true
          await startResearch(id!).catch(console.error)
        }
      }
    }

    init()
  }, [id])

  // When a message finishes streaming, commit the streamed content directly into local
  // messages — no async DB fetch, no gap, no blank frame.
  useEffect(() => {
    if (stream.messageDoneCount === 0 || !id) return
    console.log(`[Chat] messageDoneCount=${stream.messageDoneCount} — streamingTextRef.length=${streamingTextRef.current.length}`)

    const content = streamingTextRef.current.trim()
    if (content) {
      console.log(`[Chat] Committing streamed content to local messages (${content.length} chars)`)
      const committed: ChatMessage = {
        id: `local-${Date.now()}`,
        sessionId: id,
        role: 'assistant',
        content,
        createdAt: new Date().toISOString()
      }
      setMessages(prev => {
        console.log(`[Chat] setMessages: prev.length=${prev.length} → adding committed message`)
        return [...prev, committed]
      })
    } else {
      console.warn('[Chat] message_done fired but streamingTextRef was empty — nothing to commit')
    }

    streamingTextRef.current = ''
    setStreamingText('')
    setIsStreaming(false)
    console.log('[Chat] streamingText cleared, isStreaming=false')

    // Refresh papers sidebar in background — no UI blocking
    getPapers(id).then(papers => {
      console.log(`[Chat] Papers refreshed: ${papers.length} papers`)
      if (papers.length > 0) setLoadedPapers(papers)
    }).catch((err) => console.error('[Chat] Papers fetch failed:', err))
  }, [stream.messageDoneCount, id])

  useEffect(() => {
    console.log(`[Chat] stream.tokens changed → length=${stream.tokens.length}, phase=${stream.phase}`)
    streamingTextRef.current = stream.tokens
    setStreamingText(stream.tokens)
    setIsStreaming(stream.tokens.length > 0)
  }, [stream.tokens])

  // When full research workflow finishes (done comes after welcome message now)
  useEffect(() => {
    if (stream.isDone && id) {
      setSessionStatus('completed')
      ctx.refreshSessions()
    }
  }, [stream.isDone, id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, stream.agentSteps])

  const allPapers = (() => {
    const map = new Map<string, Paper>()
    loadedPapers.forEach(p => map.set(p.id, p))
    stream.papers.forEach(p => map.set(p.id, p))
    return Array.from(map.values())
  })()

  async function handleSend(text: string) {
    if (!id) return
    const content = text.trim()
    if (!content) return
    console.log('[Chat] handleSend:', content.slice(0, 80))

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sessionId: id,
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMsg])
    stream.clearTokens()
    setIsStreaming(true)
    setStreamingText('')
    streamingTextRef.current = ''

    try {
      await apiSendMessage(id, content)
    } catch {
      setIsStreaming(false)
    }
  }

  const isResearching = !stream.isDone && stream.agentSteps.some(s => s.status === 'running')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#ffffff' }}>

      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#ffffff', flexShrink: 0
      }}>
        {!ctx.sidebarOpen && (
          <button
            onClick={() => ctx.setSidebarOpen(true)}
            style={{
              background: 'none', border: '1px solid #e2e8f0', borderRadius: 7,
              padding: '4px 8px', cursor: 'pointer', color: '#94a3b8', fontSize: '0.85rem'
            }}
          >☰</button>
        )}

        <div style={{
          flex: 1, fontSize: '0.9rem', fontWeight: 600, color: '#0f172a',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {sessionInput || 'Research Session'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isResearching && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                background: '#2563eb', animation: 'pulse 1.5s ease-in-out infinite'
              }} />
              <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>Researching</span>
            </div>
          )}

          {stream.isDone && (
            <span style={{
              fontSize: '0.72rem', padding: '2px 7px', borderRadius: 999,
              background: '#f0fdf4', color: '#16a34a', fontWeight: 600
            }}>Complete</span>
          )}

          {allPapers.length > 0 && (
            <button
              onClick={() => setPapersOpen(p => !p)}
              style={{
                background: papersOpen ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${papersOpen ? '#bfdbfe' : '#e2e8f0'}`,
                borderRadius: 999, padding: '3px 9px',
                fontSize: '0.75rem', fontWeight: 600,
                color: papersOpen ? '#1d4ed8' : '#475569',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              📚 {allPapers.length}
            </button>
          )}

          <button
            onClick={() => setSettingsOpen(p => !p)}
            style={{
              background: settingsOpen ? '#f1f5f9' : 'none',
              border: '1px solid transparent', borderRadius: 7,
              padding: '5px 8px', cursor: 'pointer', fontSize: '1rem', color: '#94a3b8'
            }}
          >⚙</button>
        </div>
      </div>

      {/* Unified chat stream */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '20px 16px 12px',
        display: 'flex', flexDirection: 'column', gap: 12
      }}>
        <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Prior messages from Home page conversation */}
          {priorMessages.map(msg =>
            msg.role === 'user'
              ? <UserBubble key={msg.id} content={msg.content} />
              : (
                <AssistantBubble key={msg.id}>
                  <div className="chat-md"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                </AssistantBubble>
              )
          )}

          {/* Empty state: research just kicked off */}
          {stream.agentSteps.length === 0 && messages.length === 0 && !streamingText && priorMessages.length === 0 && (
            <AssistantBubble>
              <TypingDots />
            </AssistantBubble>
          )}

          {/* Agent step bubbles — inline in the chat flow */}
          {stream.agentSteps.map((step, i) => (
            <AgentBubble key={`${step.type}-${i}`} step={step} />
          ))}

          {/* Rate-limit countdown bubbles — appear inline when Semantic Scholar throttles */}
          {stream.rateLimits.map(rl => (
            <RateLimitBubble key={rl.id} event={rl} />
          ))}

          {/* DB messages (welcome + Q&A) */}
          {messages.map(msg =>
            msg.role === 'user'
              ? <UserBubble key={msg.id} content={msg.content} />
              : (
                <AssistantBubble key={msg.id}>
                  <div className="chat-md"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                </AssistantBubble>
              )
          )}

          {/* Live streaming bubble */}
          {streamingText && (
            <AssistantBubble streaming>
              <div className="chat-md">
                <ReactMarkdown>{streamingText}</ReactMarkdown>
              </div>
              <span style={{
                display: 'inline-block', width: 2, height: '1em',
                background: '#2563eb', marginLeft: 2, verticalAlign: 'text-bottom',
                animation: 'blink 1s step-end infinite'
              }} />
            </AssistantBubble>
          )}

          {/* Typing indicator: research is running but no tokens yet */}
          {isResearching && !streamingText && (
            <AssistantBubble>
              <TypingDots />
            </AssistantBubble>
          )}

          {/* Error */}
          {stream.error && (
            <AssistantBubble>
              <span style={{ color: '#dc2626' }}>{stream.error}</span>
            </AssistantBubble>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
        <ChatInput
          onSend={handleSend}
          disabled={isResearching}
          placeholder={
            isResearching
              ? 'Research in progress...'
              : allPapers.length > 0
              ? 'Ask about the papers, get a report, or explore a topic...'
              : 'Ask anything...'
          }
          depth={depth}
          onDepthChange={setDepth}
        />
      </div>

      <PapersSidebar papers={allPapers} open={papersOpen} onClose={() => setPapersOpen(false)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} depth={depth} onDepthChange={setDepth} />
    </div>
  )
}
