import { useState, useEffect, useRef } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import { useResearchStream } from '../hooks/useResearchStream'
import { startResearch, sendMessage as apiSendMessage, getSession, getMessages, getPapers } from '../lib/api'
import type { ChatMessage, Paper } from '../types'
import MessageBubble from '../components/MessageBubble'
import AgentStepCard from '../components/AgentStepCard'
import StreamingMessage from '../components/StreamingMessage'
import PapersSidebar from '../components/PapersSidebar'
import SettingsPanel from '../components/SettingsPanel'
import ChatInput from '../components/ChatInput'

interface OutletCtx {
  refreshSessions: () => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}

export default function Chat() {
  const { id } = useParams<{ id: string }>()
  const ctx = useOutletContext<OutletCtx>()

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

  // Reset state and start research when session id changes
  useEffect(() => {
    if (!id) return
    if (prevIdRef.current === id) return
    prevIdRef.current = id

    // Reset all state for new session
    setMessages([])
    setSessionInput('')
    setSessionStatus('running')
    setStreamingText('')
    setIsStreaming(false)
    setLoadedPapers([])
    streamingTextRef.current = ''
    started.current = false

    async function init() {
      try {
        const [session, msgs, papers] = await Promise.all([
          getSession(id!),
          getMessages(id!),
          getPapers(id!)
        ])
        if (session) {
          setSessionInput(session.input)
          setSessionStatus(session.status)
          if (session.maxDepth) setDepth(session.maxDepth)
        }
        if (msgs.length > 0) setMessages(msgs)
        if (papers.length > 0) setLoadedPapers(papers)

        // Start research if session is new (no messages yet)
        if (!started.current) {
          started.current = true
          if (msgs.length === 0) {
            await startResearch(id!)
          }
        }
      } catch (err) {
        console.error('Chat init error:', err)
        if (!started.current) {
          started.current = true
          await startResearch(id!).catch(console.error)
        }
      }
    }

    init()
  }, [id])

  // Track streaming tokens
  useEffect(() => {
    if (stream.tokens !== streamingTextRef.current) {
      streamingTextRef.current = stream.tokens
      setStreamingText(stream.tokens)
      setIsStreaming(stream.tokens.length > 0)
    }
  }, [stream.tokens])

  // When streaming stops
  useEffect(() => {
    if (!stream.tokens && streamingTextRef.current) {
      setIsStreaming(false)
    }
  }, [stream.tokens])

  // When research is done: refresh messages + papers
  useEffect(() => {
    if (stream.isDone && id) {
      setSessionStatus('completed')
      getMessages(id).then(msgs => {
        if (msgs.length > 0) setMessages(msgs)
      }).catch(() => {})
      getPapers(id).then(papers => {
        if (papers.length > 0) setLoadedPapers(papers)
      }).catch(() => {})
      ctx.refreshSessions()
    }
  }, [stream.isDone, id])

  // Merge stream papers with loaded papers
  const allPapers = (() => {
    const map = new Map<string, Paper>()
    loadedPapers.forEach(p => map.set(p.id, p))
    stream.papers.forEach(p => map.set(p.id, p))
    return Array.from(map.values())
  })()

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, stream.agentSteps])

  async function handleSend(text: string, attachment?: { type: 'pdf' | 'url'; label: string; pdfText?: string }) {
    if (!id) return
    const content = text.trim() || (attachment?.label ?? '')
    if (!content) return

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
    } catch (err) {
      console.error('Send message error:', err)
      setIsStreaming(false)
    }
  }

  const isResearching = !stream.isDone && stream.agentSteps.some(s => s.status === 'running')
  const doneSteps = stream.agentSteps.filter(s => s.status === 'done').length
  const totalSteps = stream.agentSteps.length

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: '#ffffff'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#ffffff',
        flexShrink: 0
      }}>
        {/* Sidebar toggle if closed */}
        {!ctx.sidebarOpen && (
          <button
            onClick={() => ctx.setSidebarOpen(true)}
            style={{
              background: 'none',
              border: '1px solid #e2e8f0',
              borderRadius: 7,
              padding: '4px 8px',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: '0.85rem'
            }}
          >
            ☰
          </button>
        )}

        {/* Title */}
        <div style={{
          flex: 1,
          fontSize: '0.9rem',
          fontWeight: 600,
          color: '#0f172a',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {sessionInput || 'Research Session'}
        </div>

        {/* Status + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isResearching && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#2563eb',
                animation: 'pulse 1.5s ease-in-out infinite'
              }} />
              <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                Researching
              </span>
            </div>
          )}

          {stream.isDone && (
            <span style={{
              fontSize: '0.72rem',
              padding: '2px 7px',
              borderRadius: 999,
              background: '#f0fdf4',
              color: '#16a34a',
              fontWeight: 600
            }}>
              Complete
            </span>
          )}

          {allPapers.length > 0 && (
            <button
              onClick={() => setPapersOpen(p => !p)}
              style={{
                background: papersOpen ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${papersOpen ? '#bfdbfe' : '#e2e8f0'}`,
                borderRadius: 999,
                padding: '3px 9px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: papersOpen ? '#1d4ed8' : '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 150ms ease'
              }}
            >
              📚 {allPapers.length}
            </button>
          )}

          <button
            onClick={() => setSettingsOpen(p => !p)}
            title="Settings"
            style={{
              background: settingsOpen ? '#f1f5f9' : 'none',
              border: '1px solid transparent',
              borderRadius: 7,
              padding: '5px 8px',
              cursor: 'pointer',
              fontSize: '1rem',
              color: '#94a3b8',
              transition: 'all 150ms ease'
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9' }}
            onMouseLeave={e => { if (!settingsOpen) (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 16px 8px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        {/* Empty state */}
        {messages.length === 0 && stream.agentSteps.length === 0 && !streamingText && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: 10,
            color: '#94a3b8',
            textAlign: 'center',
            padding: '40px 20px'
          }}>
            <div style={{
              width: 40,
              height: 40,
              border: '3px solid #e2e8f0',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#475569' }}>
              Starting research...
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              Agent steps and findings will appear here
            </div>
          </div>
        )}

        {/* Progress bar for agent steps */}
        {totalSteps > 0 && !stream.isDone && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: '0.75rem',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <span>{doneSteps}/{totalSteps} steps</span>
            <div style={{ flex: 1, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0}%`,
                background: '#2563eb',
                borderRadius: 2,
                transition: 'width 300ms ease'
              }} />
            </div>
          </div>
        )}

        {/* Agent steps */}
        {stream.agentSteps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {stream.agentSteps.map((step, i) => (
              <AgentStepCard key={`${step.type}-${i}`} step={step} />
            ))}
          </div>
        )}

        {/* Research complete notification */}
        {stream.isDone && allPapers.length > 0 && messages.length === 0 && !streamingText && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: '0.875rem',
            color: '#15803d',
            animation: 'fadeInUp 150ms ease'
          }}>
            Research complete — {allPapers.length} papers found. Ask me anything about them.
          </div>
        )}

        {/* Messages */}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming text */}
        <StreamingMessage text={streamingText} isStreaming={isStreaming} />

        {/* Error */}
        {stream.error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: '0.85rem',
            color: '#dc2626'
          }}>
            {stream.error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        borderTop: '1px solid #e2e8f0',
        background: '#f8fafc',
        flexShrink: 0
      }}>
        <ChatInput
          onSend={handleSend}
          disabled={isResearching && !stream.isDone}
          placeholder={
            !stream.isDone
              ? 'Research in progress...'
              : allPapers.length > 0
              ? 'Ask about the papers, get a report, or find more on a topic...'
              : 'Ask anything...'
          }
          depth={depth}
          onDepthChange={setDepth}
        />
      </div>

      {/* Papers sidebar */}
      <PapersSidebar
        papers={allPapers}
        open={papersOpen}
        onClose={() => setPapersOpen(false)}
      />

      {/* Settings panel */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        depth={depth}
        onDepthChange={setDepth}
      />
    </div>
  )
}
