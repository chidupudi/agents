import { useState, useRef, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { createSession, classifyInput } from '../lib/api'
import ChatInput from '../components/ChatInput'
import ReactMarkdown from 'react-markdown'

interface OutletCtx {
  refreshSessions: () => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}

interface HomeMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const EXAMPLES = [
  'Transformer attention mechanisms and their applications in NLP',
  'CRISPR gene editing: recent advances and ethical considerations',
  'Quantum error correction approaches for fault-tolerant computing',
  'Large language models: scaling laws and emergent capabilities',
  'Diffusion models for image generation — theory and practice'
]

export default function Home() {
  const navigate = useNavigate()
  const ctx = useOutletContext<OutletCtx>()
  const [depth, setDepth] = useState(2)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<HomeMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend(text: string, attachment?: { type: 'pdf' | 'url'; label: string; pdfText?: string }) {
    const content = text.trim() || attachment?.label || ''
    if (!content) return

    // Add user message immediately
    const userMsg: HomeMessage = { id: Date.now().toString(), role: 'user', content }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    // For plain text (no attachment), let the LLM classify intent
    if (!attachment && text.trim()) {
      const intent = await classifyInput(text.trim())
      if (intent.classification === 'conversation') {
        const reply = intent.reply || "I'm your academic research assistant. Enter a research topic, paper DOI, or upload a PDF to explore the literature."
        setMessages(prev => [...prev, { id: Date.now().toString() + '-a', role: 'assistant', content: reply }])
        setLoading(false)
        return
      }
    }

    try {
      let input = text.trim() || (attachment?.label ?? '')
      let inputType: string = 'topic'
      let pdfText: string | undefined

      if (attachment) {
        if (attachment.type === 'pdf') {
          inputType = 'pdf'
          input = attachment.label
          pdfText = attachment.pdfText
        } else if (attachment.type === 'url') {
          inputType = 'url'
          input = attachment.label
        }
      } else {
        if (text.match(/^10\.\d{4,}/)) inputType = 'doi'
        else if (text.match(/^https?:\/\//)) inputType = 'url'
      }

      const session = await createSession(input, inputType, depth, pdfText)
      ctx.refreshSessions()
      navigate(`/chat/${session.id}`, { state: { priorMessages: messages } })
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '-err',
        role: 'assistant',
        content: 'Failed to create session. Please try again.'
      }])
      setLoading(false)
    }
  }

  const showWelcome = messages.length === 0

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: '#ffffff'
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#ffffff',
        flexShrink: 0
      }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
          New Research
        </div>
      </div>

      {/* Message area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 16px 12px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ width: '100%', maxWidth: 700, margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* Welcome screen — shown only before any interaction */}
          {showWelcome && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <div style={{ fontSize: '2.2rem', marginBottom: 14 }}>🔬</div>
                <h1 style={{
                  fontSize: '1.55rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  marginBottom: 10,
                  letterSpacing: '-0.02em'
                }}>
                  Academic Research Detective
                </h1>
                <p style={{
                  fontSize: '0.925rem',
                  color: '#64748b',
                  lineHeight: 1.65,
                  maxWidth: 460,
                  margin: '0 auto'
                }}>
                  Enter a research topic, paper DOI, or upload a PDF. Multi-agent AI will explore the literature and synthesize insights.
                </p>
              </div>

              {/* Example prompts */}
              <div>
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: '#94a3b8',
                  marginBottom: 10,
                  textAlign: 'center'
                }}>
                  Try one of these
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(ex)}
                      disabled={loading}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: '0.875rem',
                        color: '#475569',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 150ms ease',
                        lineHeight: 1.4
                      }}
                      onMouseEnter={e => {
                        const btn = e.currentTarget as HTMLButtonElement
                        btn.style.background = '#eff6ff'
                        btn.style.borderColor = '#bfdbfe'
                        btn.style.color = '#1d4ed8'
                      }}
                      onMouseLeave={e => {
                        const btn = e.currentTarget as HTMLButtonElement
                        btn.style.background = '#f8fafc'
                        btn.style.borderColor = '#e2e8f0'
                        btn.style.color = '#475569'
                      }}
                    >
                      <span style={{ marginRight: 8, opacity: 0.4 }}>→</span>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    animation: 'fadeInUp 150ms ease'
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      flexShrink: 0,
                      marginRight: 8,
                      marginTop: 2
                    }}>
                      🔬
                    </div>
                  )}
                  <div style={{
                    maxWidth: '78%',
                    padding: msg.role === 'user' ? '10px 14px' : '12px 16px',
                    borderRadius: msg.role === 'user'
                      ? '16px 16px 4px 16px'
                      : '4px 16px 16px 16px',
                    background: msg.role === 'user' ? '#eff6ff' : '#ffffff',
                    border: msg.role === 'user' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                    fontSize: '0.9rem',
                    color: '#0f172a',
                    lineHeight: 1.65,
                    boxShadow: msg.role === 'assistant' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                  }}>
                    {msg.role === 'assistant'
                      ? <div className="chat-md"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                      : msg.content
                    }
                  </div>
                </div>
              ))}

              {/* Typing indicator while loading */}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    flexShrink: 0
                  }}>
                    🔬
                  </div>
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px 16px 16px 16px',
                    padding: '12px 16px',
                    display: 'flex',
                    gap: 5,
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#94a3b8',
                        animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input pinned to bottom */}
      <div style={{
        borderTop: '1px solid #e2e8f0',
        background: '#f8fafc',
        flexShrink: 0
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <ChatInput
            onSend={handleSend}
            disabled={loading}
            placeholder={messages.length > 0
              ? 'Enter a research topic, DOI, or upload a PDF...'
              : 'Research topic, DOI, or URL — or attach a PDF...'
            }
            depth={depth}
            onDepthChange={setDepth}
          />
        </div>
      </div>
    </div>
  )
}
