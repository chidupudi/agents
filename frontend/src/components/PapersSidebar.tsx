import { useState } from 'react'
import type { Paper } from '../types'

interface PapersSidebarProps {
  papers: Paper[]
  open: boolean
  onClose: () => void
}

function PaperCompactCard({ paper }: { paper: Paper }) {
  const [expanded, setExpanded] = useState(false)
  const authorsDisplay = paper.authors.slice(0, 2).join(', ') +
    (paper.authors.length > 2 ? ` +${paper.authors.length - 2}` : '')

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'border-color 150ms ease',
        animation: 'fadeInUp 150ms ease'
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#bfdbfe' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0' }}
      onClick={() => setExpanded(p => !p)}
    >
      <div style={{
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#0f172a',
        lineHeight: 1.35,
        marginBottom: 4
      }}>
        {paper.title}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: '0.72rem',
        color: '#94a3b8'
      }}>
        {paper.year > 0 && <span>{paper.year}</span>}
        {paper.citationCount > 0 && <span>{paper.citationCount.toLocaleString()} cites</span>}
        <span style={{
          marginLeft: 'auto',
          padding: '1px 6px',
          borderRadius: 999,
          fontSize: '0.65rem',
          fontWeight: 600,
          background: paper.status === 'fetched' ? '#f0fdf4' : paper.status === 'root' ? '#eff6ff' : '#f8fafc',
          color: paper.status === 'fetched' ? '#16a34a' : paper.status === 'root' ? '#2563eb' : '#94a3b8'
        }}>
          {paper.status}
        </span>
      </div>

      {paper.authors.length > 0 && (
        <div style={{
          fontSize: '0.72rem',
          color: '#475569',
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {authorsDisplay}
        </div>
      )}

      {expanded && paper.abstract && (
        <div style={{
          marginTop: 8,
          fontSize: '0.78rem',
          color: '#475569',
          lineHeight: 1.55,
          borderTop: '1px solid #e2e8f0',
          paddingTop: 8
        }}>
          {paper.abstract.length > 400
            ? paper.abstract.slice(0, 400) + '…'
            : paper.abstract}
        </div>
      )}
    </div>
  )
}

export default function PapersSidebar({ papers, open, onClose }: PapersSidebarProps) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.15)',
            zIndex: 40,
            backdropFilter: 'blur(1px)'
          }}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 300,
        height: '100vh',
        background: '#f8fafc',
        borderLeft: '1px solid #e2e8f0',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease',
        boxShadow: open ? '-4px 0 20px rgba(0,0,0,0.08)' : 'none'
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
              Papers Found
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 1 }}>
              {papers.length} paper{papers.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: '1.1rem',
              padding: '4px',
              borderRadius: 4,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Papers list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {papers.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '60%',
              gap: 8,
              color: '#94a3b8',
              fontSize: '0.85rem',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '2rem' }}>📚</span>
              Papers will appear here as research runs
            </div>
          ) : (
            papers.map(paper => (
              <PaperCompactCard key={paper.id} paper={paper} />
            ))
          )}
        </div>
      </div>
    </>
  )
}
