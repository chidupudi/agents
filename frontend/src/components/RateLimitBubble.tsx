import { useState, useEffect } from 'react'
import type { RateLimitEvent } from '../hooks/useResearchStream'

interface RateLimitBubbleProps {
  event: RateLimitEvent
}

export default function RateLimitBubble({ event }: RateLimitBubbleProps) {
  const totalSecs = Math.ceil(event.waitMs / 1000)
  const [remaining, setRemaining] = useState(totalSecs)

  useEffect(() => {
    if (remaining <= 0) return
    const timer = setInterval(() => {
      const elapsed = (Date.now() - event.startedAt) / 1000
      const left = Math.max(0, Math.ceil(totalSecs - elapsed))
      setRemaining(left)
    }, 250)
    return () => clearInterval(timer)
  }, [event.startedAt, totalSecs])

  const progress = remaining > 0 ? remaining / totalSecs : 0
  const done = remaining === 0

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, animation: 'fadeInUp 150ms ease' }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: '#fff7ed', border: '1px solid #fed7aa',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', flexShrink: 0, marginTop: 2
      }}>
        ⏳
      </div>

      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '4px 14px 14px 14px',
        padding: '8px 12px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        minWidth: 220
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: '#ea580c',
            background: '#fff7ed', border: '1px solid #fed7aa',
            borderRadius: 999, padding: '1px 7px', flexShrink: 0
          }}>
            Rate Limit
          </span>
          <span style={{ fontSize: '0.83rem', color: '#64748b', flex: 1 }}>
            {done ? 'Resuming search...' : `Semantic Scholar — waiting ${remaining}s`}
          </span>
          {!done && (
            <span style={{
              fontSize: '1rem', fontWeight: 700, color: '#ea580c',
              fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 28, textAlign: 'right'
            }}>
              {remaining}s
            </span>
          )}
          {done && <span style={{ color: '#16a34a', fontSize: '0.75rem' }}>✓</span>}
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: done ? '#16a34a' : '#ea580c',
            borderRadius: 2,
            transition: 'width 250ms linear, background 300ms ease'
          }} />
        </div>
      </div>
    </div>
  )
}
