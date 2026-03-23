import { useState } from 'react'
import type { Paper } from '../types'

interface PaperCardProps {
  paper: Paper
}

const statusColors: Record<string, { bg: string; color: string }> = {
  fetched: { bg: '#022c0e', color: '#22c55e' },
  root: { bg: '#0d1e33', color: '#3b82f6' },
  queued: { bg: '#1c1500', color: '#eab308' },
  skipped: { bg: '#1a1a1a', color: '#64748b' }
}

const styles = {
  card: {
    background: '#1a1d27',
    border: '1px solid #2d3147',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '10px',
    cursor: 'pointer',
    transition: 'border-color 0.2s'
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '6px'
  },
  title: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#e2e8f0',
    lineHeight: 1.4,
    flex: 1
  },
  badges: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-end'
  },
  badge: {
    padding: '2px 7px',
    borderRadius: '9999px',
    fontSize: '0.7rem',
    fontWeight: 600
  },
  depthBadge: {
    background: '#1e2535',
    color: '#64748b',
    padding: '2px 7px',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: 600
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '0.75rem',
    color: '#64748b',
    marginBottom: '8px',
    flexWrap: 'wrap' as const
  },
  authors: {
    color: '#94a3b8',
    fontSize: '0.75rem',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  relevanceBar: {
    height: '4px',
    borderRadius: '2px',
    background: '#1e2535',
    overflow: 'hidden',
    marginBottom: '8px'
  },
  relevanceFill: {
    height: '100%',
    borderRadius: '2px',
    background: 'linear-gradient(to right, #3b82f6, #22c55e)',
    transition: 'width 0.3s ease'
  },
  abstract: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    lineHeight: 1.6,
    marginTop: '8px',
    borderTop: '1px solid #2d3147',
    paddingTop: '8px'
  },
  expandHint: {
    fontSize: '0.7rem',
    color: '#3b82f6',
    marginTop: '6px'
  }
}

export default function PaperCard({ paper }: PaperCardProps) {
  const [expanded, setExpanded] = useState(false)

  const statusStyle = statusColors[paper.status] || statusColors.fetched
  const authorsDisplay = paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : '')
  const relevancePct = Math.round(paper.relevanceScore * 100)

  return (
    <div
      style={{
        ...styles.card,
        borderColor: expanded ? '#3b82f6' : '#2d3147'
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={styles.header}>
        <div style={styles.title}>{paper.title}</div>
        <div style={styles.badges}>
          <span style={{ ...styles.badge, ...statusStyle }}>{paper.status}</span>
          <span style={styles.depthBadge}>D{paper.depth}</span>
        </div>
      </div>

      <div style={styles.authors}>{authorsDisplay || 'Unknown authors'}</div>

      <div style={styles.meta}>
        {paper.year > 0 && <span>{paper.year}</span>}
        <span>{paper.citationCount.toLocaleString()} citations</span>
        {paper.doi && <span style={{ color: '#3b82f6' }}>DOI</span>}
        {paper.arxivId && <span style={{ color: '#a855f7' }}>arXiv</span>}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Relevance</span>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{relevancePct}%</span>
        </div>
        <div style={styles.relevanceBar}>
          <div style={{ ...styles.relevanceFill, width: `${relevancePct}%` }} />
        </div>
      </div>

      {expanded && (
        <div style={styles.abstract}>
          {paper.abstract ? paper.abstract : 'No abstract available.'}
        </div>
      )}

      <div style={styles.expandHint}>
        {expanded ? '▲ Click to collapse' : '▼ Click to expand abstract'}
      </div>
    </div>
  )
}
