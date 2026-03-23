import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useParams, NavLink } from 'react-router-dom'
import { getSessions, createSession } from '../lib/api'
import type { Session } from '../types'

const SIDEBAR_WIDTH = 240

export default function ChatLayout() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const activeId = params.id

  const [sessions, setSessions] = useState<Session[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions() {
    const s = await getSessions()
    setSessions(s)
  }

  async function handleNewResearch() {
    navigate('/')
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#ffffff' }}>
      {/* Mobile hamburger */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 100,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            width: 36,
            height: 36,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}
          aria-label="Open sidebar"
        >
          ☰
        </button>
      )}

      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? SIDEBAR_WIDTH : 0,
          minWidth: sidebarOpen ? SIDEBAR_WIDTH : 0,
          height: '100vh',
          background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 150ms ease, min-width 150ms ease',
          flexShrink: 0
        }}
      >
        {/* Sidebar header */}
        <div style={{
          padding: '14px 12px 10px 12px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexShrink: 0
        }}>
          <span style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#2563eb',
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap'
          }}>
            Research Detective
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: '1rem',
              padding: '2px 4px',
              borderRadius: 4,
              lineHeight: 1
            }}
            title="Collapse sidebar"
          >
            ←
          </button>
        </div>

        {/* New Research button */}
        <div style={{ padding: '10px 10px 6px 10px', flexShrink: 0 }}>
          <button
            onClick={handleNewResearch}
            disabled={creating}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.83rem',
              fontWeight: 600,
              cursor: creating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              transition: 'background 150ms ease',
              opacity: creating ? 0.7 : 1
            }}
            onMouseEnter={e => { if (!creating) (e.currentTarget as HTMLButtonElement).style.background = '#1d4ed8' }}
            onMouseLeave={e => { if (!creating) (e.currentTarget as HTMLButtonElement).style.background = '#2563eb' }}
          >
            <span style={{ fontSize: '0.9rem' }}>+</span>
            New Research
          </button>
        </div>

        {/* Sessions list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
          {sessions.length === 0 && (
            <div style={{
              padding: '16px 8px',
              fontSize: '0.78rem',
              color: '#94a3b8',
              textAlign: 'center',
              lineHeight: 1.5
            }}>
              No sessions yet.<br />Start a new research above.
            </div>
          )}

          {sessions.map(session => {
            const isActive = session.id === activeId
            return (
              <NavLink
                key={session.id}
                to={`/chat/${session.id}`}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 7,
                    background: isActive ? '#eff6ff' : 'transparent',
                    cursor: 'pointer',
                    marginBottom: 1,
                    transition: 'background 150ms ease',
                    border: isActive ? '1px solid #bfdbfe' : '1px solid transparent'
                  }}
                  onMouseEnter={e => {
                    if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#f1f5f9'
                  }}
                  onMouseLeave={e => {
                    if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                >
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#1d4ed8' : '#0f172a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                    marginBottom: 3
                  }}>
                    {session.input}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span style={{
                      fontSize: '0.68rem',
                      color: '#94a3b8'
                    }}>
                      {formatDate(session.createdAt)}
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '1px 5px',
                      borderRadius: 999,
                      fontWeight: 600,
                      background: session.status === 'completed'
                        ? '#f0fdf4'
                        : session.status === 'running'
                        ? '#eff6ff'
                        : '#fef2f2',
                      color: session.status === 'completed'
                        ? '#16a34a'
                        : session.status === 'running'
                        ? '#2563eb'
                        : '#dc2626'
                    }}>
                      {session.status}
                    </span>
                  </div>
                </div>
              </NavLink>
            )
          })}
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Outlet context={{ refreshSessions: loadSessions, sidebarOpen, setSidebarOpen }} />
      </div>
    </div>
  )
}
