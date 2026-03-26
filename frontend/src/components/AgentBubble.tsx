import { useState } from 'react'
import type { AgentStep } from '../types'

const AGENT_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: string }> = {
  plan:   { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', label: 'Planner',   icon: '🧠' },
  fetch:  { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Retriever', icon: '🔍' },
  embed:  { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Embedder',  icon: '⚡' },
  reason: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Reasoning', icon: '💡' },
  tutor:  { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', label: 'Tutor',     icon: '🎓' },
  report: { color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', label: 'Reporter',  icon: '📊' }
}

interface AgentBubbleProps {
  step: AgentStep
}

export default function AgentBubble({ step }: AgentBubbleProps) {
  const [expanded, setExpanded] = useState(false)
  const cfg = AGENT_CONFIG[step.type] || AGENT_CONFIG.plan
  const isRunning = step.status === 'running'
  const hasData = !!step.data && Object.keys(step.data).length > 0

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      gap: 8,
      animation: 'fadeInUp 150ms ease'
    }}>
      {/* Agent avatar */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        flexShrink: 0,
        marginTop: 2
      }}>
        {cfg.icon}
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: '82%',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '4px 14px 14px 14px',
          padding: '8px 12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          cursor: hasData && !isRunning ? 'pointer' : 'default'
        }}
        onClick={() => { if (hasData && !isRunning) setExpanded(p => !p) }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'nowrap' }}>
          {/* Agent name pill */}
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: cfg.color,
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            borderRadius: 999,
            padding: '1px 7px',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}>
            {cfg.label}
          </span>

          {/* Message */}
          <span style={{
            fontSize: '0.855rem',
            color: '#475569',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: expanded ? 'normal' : 'nowrap'
          }}>
            {step.message}
          </span>

          {/* Status */}
          {isRunning ? (
            <span style={{
              width: 12,
              height: 12,
              border: `2px solid ${cfg.color}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              display: 'inline-block',
              flexShrink: 0
            }} />
          ) : (
            <span style={{ color: '#16a34a', fontSize: '0.75rem', flexShrink: 0 }}>✓</span>
          )}

          {/* Expand toggle */}
          {hasData && !isRunning && (
            <span style={{ color: '#cbd5e1', fontSize: '0.65rem', flexShrink: 0 }}>
              {expanded ? '▲' : '▼'}
            </span>
          )}
        </div>

        {/* Expanded details */}
        {expanded && hasData && (
          <div style={{
            marginTop: 8,
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: '0.74rem',
            color: '#475569',
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflowY: 'auto'
          }}>
            {JSON.stringify(step.data, null, 2)}
          </div>
        )}
      </div>
    </div>
  )
}
