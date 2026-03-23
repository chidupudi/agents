import { useState, useEffect, useCallback } from 'react'
import type { Session, Paper, ChatMessage } from '../types'
import { getSession, getPapers, getMessages, sendMessage as apiSendMessage, startResearch as apiStartResearch } from '../lib/api'

interface UseSessionReturn {
  session: Session | null
  papers: Paper[]
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  sendMessage: (text: string) => Promise<void>
  startResearch: () => Promise<void>
  refreshPapers: () => Promise<void>
  refreshMessages: () => Promise<void>
}

export function useSession(sessionId: string | null): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null)
  const [papers, setPapers] = useState<Paper[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return

    setLoading(true)
    Promise.all([
      getSession(sessionId),
      getPapers(sessionId),
      getMessages(sessionId)
    ]).then(([s, p, m]) => {
      setSession(s)
      setPapers(p)
      setMessages(m)
      setLoading(false)
    }).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to load session')
      setLoading(false)
    })
  }, [sessionId])

  const refreshPapers = useCallback(async () => {
    if (!sessionId) return
    const p = await getPapers(sessionId)
    setPapers(p)
  }, [sessionId])

  const refreshMessages = useCallback(async () => {
    if (!sessionId) return
    const m = await getMessages(sessionId)
    setMessages(m)
  }, [sessionId])

  const sendMessage = useCallback(async (text: string) => {
    if (!sessionId) return
    try {
      await apiSendMessage(sessionId, text)
      await refreshMessages()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    }
  }, [sessionId, refreshMessages])

  const startResearch = useCallback(async () => {
    if (!sessionId) return
    try {
      await apiStartResearch(sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start research')
    }
  }, [sessionId])

  return {
    session,
    papers,
    messages,
    loading,
    error,
    sendMessage,
    startResearch,
    refreshPapers,
    refreshMessages
  }
}
