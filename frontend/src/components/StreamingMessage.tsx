import ReactMarkdown from 'react-markdown'

interface StreamingMessageProps {
  text: string
  isStreaming: boolean
}

function renderContent(content: string) {
  const parts = content.split(/(From the paper: '[^']*')/g)
  if (parts.length <= 1) {
    return (
      <div className="chat-md">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    )
  }
  return (
    <div className="chat-md">
      {parts.map((part, i) => {
        if (part.match(/^From the paper:/)) {
          return (
            <blockquote key={i} style={{
              borderLeft: '3px solid #2563eb',
              paddingLeft: 12,
              margin: '8px 0',
              color: '#475569',
              fontStyle: 'italic'
            }}>
              {part}
            </blockquote>
          )
        }
        return part ? <ReactMarkdown key={i}>{part}</ReactMarkdown> : null
      })}
    </div>
  )
}

export default function StreamingMessage({ text, isStreaming }: StreamingMessageProps) {
  if (!text && !isStreaming) return null

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-start',
      animation: 'fadeInUp 150ms ease'
    }}>
      <div style={{
        maxWidth: '85%',
        background: '#ffffff',
        border: '1px solid #2563eb',
        borderRadius: '4px 16px 16px 16px',
        padding: '12px 16px',
        fontSize: '0.9rem',
        color: '#0f172a',
        lineHeight: 1.7,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {text ? renderContent(text) : null}
        {isStreaming && (
          <span style={{
            display: 'inline-block',
            width: 2,
            height: '1em',
            background: '#2563eb',
            marginLeft: 2,
            verticalAlign: 'text-bottom',
            animation: 'blink 1s step-end infinite',
            borderRadius: 1
          }} />
        )}
      </div>
    </div>
  )
}
