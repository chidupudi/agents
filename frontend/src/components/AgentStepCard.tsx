import { useState } from 'react'
import type { AgentStep } from '../types'

interface AgentStepCardProps {
  step: AgentStep
}

const typeConfig: Record<string, {
  color: string
  bg: string
  border: string
  label: string
  icon: string
}> = {
  plan:   { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', label: 'Planner',   icon: '🧠' },
  fetch:  { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Retriever', icon: '🔍' },
  embed:  { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Embedder',  icon: '⚡' },
  reason: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Reasoning', icon: '💡' },
  tutor:  { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', label: 'Tutor',     icon: '🎓' },
  report: { color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', label: 'Reporter',  icon: '📊' }
}

export default function AgentStepCard({ step }: AgentStepCardProps) {
  const [expanded, setExpanded] = useState(false)
  const cfg = typeConfig[step.type] || typeConfig.plan

  const isRunning = step.status === 'running'
  const isError = step.status === 'error'

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        padding: '10px 14px',
        margin: '4px 0',
        fontSize: '0.85rem',
        animation: 'fadeInUp 150ms ease',
        cursor: step.data ? 'pointer' : 'default'
      }}
      onClick={() => { if (step.data) setExpanded(prev => !prev) }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        {/* Agent icon */}
        <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{cfg.icon}</span>

        {/* Label */}
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: cfg.color,
          flexShrink: 0
        }}>
          {cfg.label}
        </span>

        {/* Message */}
        <span style={{
          flex: 1,
          color: '#475569',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: expanded ? 'normal' : 'nowrap'
        }}>
          {step.message}
        </span>

        {/* Status indicator */}
        <span style={{ flexShrink: 0, marginLeft: 4 }}>
          {isRunning ? (
            <span style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: `2px solid ${cfg.color}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              verticalAlign: 'middle'
            }} />
          ) : isError ? (
            <span style={{ color: '#dc2626', fontWeight: 700 }}>✗</span>
          ) : (
            <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
          )}
        </span>

        {/* Expand hint */}
        {step.data && !isRunning && (
          <span style={{ color: '#94a3b8', fontSize: '0.7rem', flexShrink: 0 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* Expanded data */}
      {expanded && step.data && (
        <div style={{
          marginTop: 8,
          background: 'rgba(255,255,255,0.7)',
          border: `1px solid ${cfg.border}`,
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: '0.75rem',
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
  )
}
