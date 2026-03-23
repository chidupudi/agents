import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from '../types'

interface MessageBubbleProps {
  message: ChatMessage
}

function renderContent(content: string) {
  // Split on "From the paper: '...'" to render as blockquotes
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

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeInUp 150ms ease'
      }}>
        <div style={{
          maxWidth: '75%',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '16px 16px 4px 16px',
          padding: '10px 14px',
          fontSize: '0.9rem',
          color: '#0f172a',
          lineHeight: 1.6
        }}>
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-start',
      animation: 'fadeInUp 150ms ease'
    }}>
      <div style={{
        maxWidth: '85%',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '4px 16px 16px 16px',
        padding: '12px 16px',
        fontSize: '0.9rem',
        color: '#0f172a',
        lineHeight: 1.7,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {renderContent(message.content)}
      </div>
    </div>
  )
}
