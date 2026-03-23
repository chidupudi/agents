import { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface Attachment {
  type: 'pdf' | 'url'
  label: string
  pdfText?: string
}

interface ChatInputProps {
  onSend: (text: string, attachment?: Attachment) => void
  disabled?: boolean
  placeholder?: string
  depth: number
  onDepthChange: (d: number) => void
}

async function extractPdfText(file: File, onProgress: (pct: number) => void): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n'
    onProgress(Math.round((i / pdf.numPages) * 100))
  }
  return fullText
}

export default function ChatInput({ onSend, disabled, placeholder, depth, onDepthChange }: ChatInputProps) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [showDepthPopover, setShowDepthPopover] = useState(false)
  const [pdfProgress, setPdfProgress] = useState(0)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const depthRef = useRef<HTMLDivElement>(null)

  // Auto-grow textarea
  function adjustHeight() {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }

  useEffect(() => {
    adjustHeight()
  }, [text])

  // Close popups on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false)
      }
      if (depthRef.current && !depthRef.current.contains(e.target as Node)) {
        setShowDepthPopover(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed && !attachment) return
    if (disabled) return
    onSend(trimmed || (attachment?.label ?? ''), attachment ?? undefined)
    setText('')
    setAttachment(null)
    setShowUrlInput(false)
    setUrlValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.includes('pdf')) return

    setPdfLoading(true)
    setPdfProgress(0)
    setShowAttachMenu(false)

    try {
      const pdfText = await extractPdfText(file, setPdfProgress)
      setAttachment({ type: 'pdf', label: file.name, pdfText })
    } catch (err) {
      console.error('PDF extraction error:', err)
    } finally {
      setPdfLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleUrlConfirm() {
    const url = urlValue.trim()
    if (!url) return
    setAttachment({ type: 'url', label: url })
    setShowUrlInput(false)
    setUrlValue('')
  }

  const canSend = !disabled && !pdfLoading && (text.trim().length > 0 || attachment !== null)

  return (
    <div style={{ padding: '12px 16px 16px 16px' }}>
      {/* Attachment pills */}
      {attachment && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 999,
            padding: '3px 10px 3px 8px',
            fontSize: '0.78rem',
            color: '#475569'
          }}>
            <span>{attachment.type === 'pdf' ? '📄' : '🔗'}</span>
            <span style={{
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {attachment.label}
            </span>
            <button
              onClick={() => setAttachment(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: '0.9rem',
                padding: 0,
                lineHeight: 1,
                marginLeft: 2
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* PDF loading progress */}
      {pdfLoading && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 4 }}>
            Extracting PDF... {pdfProgress}%
          </div>
          <div style={{ height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pdfProgress}%`,
              background: '#2563eb',
              borderRadius: 2,
              transition: 'width 0.2s'
            }} />
          </div>
        </div>
      )}

      {/* URL input */}
      {showUrlInput && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            type="url"
            placeholder="https://arxiv.org/abs/..."
            value={urlValue}
            onChange={e => setUrlValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleUrlConfirm() }}
            autoFocus
            style={{
              flex: 1,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: '0.83rem',
              outline: 'none',
              color: '#0f172a'
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#2563eb' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0' }}
          />
          <button
            onClick={handleUrlConfirm}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Add
          </button>
          <button
            onClick={() => { setShowUrlInput(false); setUrlValue('') }}
            style={{
              background: 'none',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: '0.8rem',
              color: '#94a3b8',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main input bar */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        padding: '8px 8px 8px 12px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'border-color 150ms ease'
      }}
        onFocus={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2563eb' }}
        onBlur={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0' }}
      >
        {/* Left controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {/* Attach menu */}
          <div ref={attachMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAttachMenu(p => !p)}
              title="Attach file or URL"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: '1.05rem',
                padding: '4px 6px',
                borderRadius: 6,
                lineHeight: 1,
                transition: 'color 150ms ease'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8' }}
            >
              📎
            </button>

            {showAttachMenu && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                marginBottom: 6,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                minWidth: 150,
                overflow: 'hidden',
                zIndex: 20
              }}>
                <button
                  onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '9px 14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.83rem',
                    color: '#0f172a',
                    textAlign: 'left',
                    transition: 'background 150ms ease'
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                >
                  <span>📄</span> Upload PDF
                </button>
              </div>
            )}
          </div>

          {/* URL button */}
          <button
            onClick={() => { setShowUrlInput(p => !p); setShowAttachMenu(false) }}
            title="Add URL"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: '1.05rem',
              padding: '4px 6px',
              borderRadius: 6,
              lineHeight: 1,
              transition: 'color 150ms ease'
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8' }}
          >
            🔗
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 18, background: '#e2e8f0', margin: '0 2px' }} />
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Ask anything or start research...'}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontSize: '0.9rem',
            color: '#0f172a',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            maxHeight: 120,
            padding: '2px 0',
            minHeight: 24,
            opacity: disabled ? 0.6 : 1
          }}
        />

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Depth pill */}
          <div ref={depthRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDepthPopover(p => !p)}
              title="Research depth"
              style={{
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: 999,
                padding: '3px 9px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 150ms ease'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e2e8f0' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9' }}
            >
              Depth: {depth} ▾
            </button>

            {showDepthPopover && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: 8,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                padding: '14px 16px',
                width: 220,
                zIndex: 20
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a', marginBottom: 10 }}>
                  Research Depth
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
                  fontSize: '0.7rem',
                  color: '#94a3b8',
                  marginTop: 4
                }}>
                  <span>Quick</span>
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>{depth}</span>
                  <span>Deep</span>
                </div>
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            title="Send"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: canSend ? '#2563eb' : '#e2e8f0',
              border: 'none',
              cursor: canSend ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms ease',
              flexShrink: 0
            }}
            onMouseEnter={e => { if (canSend) (e.currentTarget as HTMLButtonElement).style.background = '#1d4ed8' }}
            onMouseLeave={e => { if (canSend) (e.currentTarget as HTMLButtonElement).style.background = '#2563eb' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 5, textAlign: 'center' }}>
        Enter to send · Shift+Enter for newline
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}
