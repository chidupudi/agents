import { useEffect, useState } from 'react'

interface ModelInfo {
  id: string
  displayName: string
  hasThinking: boolean
  outputTokenLimit: number
  inputTokenLimit: number
}

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  depth: number
  onDepthChange: (d: number) => void
}

async function fetchModels(): Promise<Record<string, ModelInfo>> {
  try {
    const res = await fetch('/api/models')
    if (!res.ok) return {}
    return res.json()
  } catch {
    return {}
  }
}

export default function SettingsPanel({ open, onClose, depth, onDepthChange }: SettingsPanelProps) {
  const [models, setModels] = useState<Record<string, ModelInfo>>({})

  useEffect(() => {
    if (open && Object.keys(models).length === 0) {
      fetchModels().then(setModels)
    }
  }, [open])

  const roleLabels: Record<string, string> = {
    planner: 'Planner',
    retriever: 'Retriever',
    reasoning: 'Reasoning',
    tutor: 'Tutor',
    report: 'Report',
    orchestrator: 'Orchestrator'
  }

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
        width: 320,
        height: '100vh',
        background: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease',
        boxShadow: open ? '-4px 0 20px rgba(0,0,0,0.08)' : 'none',
        animation: open ? 'slideInRight 200ms ease' : 'none'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Settings</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: '1.2rem',
              padding: '4px',
              borderRadius: 4,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* Research Depth */}
          <section style={{ marginBottom: 28 }}>
            <h3 style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#94a3b8',
              marginBottom: 14
            }}>
              Research Settings
            </h3>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '14px 16px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10
              }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                  Research Depth
                </label>
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#2563eb',
                  background: '#eff6ff',
                  padding: '2px 8px',
                  borderRadius: 6
                }}>
                  {depth}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={depth}
                onChange={e => onDepthChange(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#2563eb' }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: '#94a3b8',
                marginTop: 4
              }}>
                <span>Quick (1)</span>
                <span>Balanced (3)</span>
                <span>Deep (5)</span>
              </div>
              <div style={{
                marginTop: 10,
                fontSize: '0.78rem',
                color: '#475569',
                lineHeight: 1.5,
                padding: '8px 10px',
                background: '#ffffff',
                borderRadius: 6,
                border: '1px solid #e2e8f0'
              }}>
                {depth <= 1 && 'Quick scan: finds ~10 papers, fastest results.'}
                {depth === 2 && 'Balanced: finds ~20–30 papers with good coverage.'}
                {depth === 3 && 'Thorough: explores references 3 levels deep.'}
                {depth === 4 && 'Deep: comprehensive, may take several minutes.'}
                {depth >= 5 && 'Maximum depth: exhaustive research, slowest mode.'}
              </div>
            </div>
          </section>

          {/* Model Info */}
          <section style={{ marginBottom: 28 }}>
            <h3 style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#94a3b8',
              marginBottom: 14
            }}>
              Active Models
            </h3>

            {Object.keys(models).length === 0 ? (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 14,
                fontSize: '0.82rem',
                color: '#94a3b8',
                textAlign: 'center'
              }}>
                Loading model info...
              </div>
            ) : (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                overflow: 'hidden'
              }}>
                {Object.entries(models).map(([role, info], i, arr) => (
                  <div
                    key={role}
                    style={{
                      padding: '10px 14px',
                      borderBottom: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8
                    }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
                          {roleLabels[role] || role}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 2 }}>
                          {info.id}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {info.hasThinking && (
                          <span style={{
                            fontSize: '0.62rem',
                            padding: '1px 5px',
                            borderRadius: 999,
                            background: '#f5f3ff',
                            color: '#7c3aed',
                            fontWeight: 600
                          }}>
                            thinking
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.62rem',
                          padding: '1px 5px',
                          borderRadius: 999,
                          background: '#f1f5f9',
                          color: '#475569',
                          fontWeight: 600
                        }}>
                          {Math.round(info.outputTokenLimit / 1000)}K out
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* About */}
          <section>
            <h3 style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#94a3b8',
              marginBottom: 14
            }}>
              About
            </h3>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '14px 16px',
              fontSize: '0.82rem',
              color: '#475569',
              lineHeight: 1.6
            }}>
              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                Academic Research Detective
              </div>
              AI-powered multi-agent research system that explores academic literature, finds related papers, and synthesizes insights.
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
