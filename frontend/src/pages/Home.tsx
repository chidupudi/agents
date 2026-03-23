import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { createSession } from '../lib/api'
import ChatInput from '../components/ChatInput'

interface OutletCtx {
  refreshSessions: () => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
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
  const [error, setError] = useState('')

  async function handleSend(text: string, attachment?: { type: 'pdf' | 'url'; label: string; pdfText?: string }) {
    if (!text.trim() && !attachment) return
    setLoading(true)
    setError('')

    try {
      let input = text.trim()
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
        // Detect DOI
        if (text.match(/^10\.\d{4,}/)) {
          inputType = 'doi'
        } else if (text.match(/^https?:\/\//)) {
          inputType = 'url'
        }
      }

      const session = await createSession(input, inputType, depth, pdfText)
      ctx.refreshSessions()
      navigate(`/chat/${session.id}`)
    } catch (err) {
      setError('Failed to create session. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
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

      {/* Center content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        overflowY: 'auto'
      }}>
        <div style={{ width: '100%', maxWidth: 680 }}>
          {/* Welcome */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔬</div>
            <h1 style={{
              fontSize: '1.6rem',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: 10,
              letterSpacing: '-0.02em'
            }}>
              Academic Research Detective
            </h1>
            <p style={{
              fontSize: '0.95rem',
              color: '#475569',
              lineHeight: 1.6,
              maxWidth: 480,
              margin: '0 auto'
            }}>
              Enter a research topic, paper DOI, or upload a PDF. Multi-agent AI will explore the literature and synthesize insights.
            </p>
          </div>

          {/* Examples */}
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: '0.75rem',
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
                  <span style={{ marginRight: 8, opacity: 0.5 }}>→</span>
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: '0.85rem',
              color: '#dc2626',
              marginBottom: 12
            }}>
              {error}
            </div>
          )}

          {/* Loading overlay message */}
          {loading && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: '0.85rem',
              color: '#1d4ed8',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
              Creating session...
            </div>
          )}
        </div>
      </div>

      {/* Input at bottom */}
      <div style={{
        borderTop: '1px solid #e2e8f0',
        background: '#f8fafc',
        flexShrink: 0
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <ChatInput
            onSend={handleSend}
            disabled={loading}
            placeholder="Research topic, DOI, or URL — or attach a PDF..."
            depth={depth}
            onDepthChange={setDepth}
          />
        </div>
      </div>
    </div>
  )
}
