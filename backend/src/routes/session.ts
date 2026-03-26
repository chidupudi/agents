import { Router } from 'express'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { env } from '../env.js'
import {
  createSession,
  getSession,
  getPapersForSession,
  getMessagesForSession,
  saveMessage,
  updateSessionStatus
} from '../db/sessions.js'
import { runResearchWorkflow } from '../workflows/researchWorkflow.js'
import { runTutor, runChat } from '../agents/tutor.js'
import { runReport } from '../agents/report.js'
import { detectIntent, classifyInput } from '../agents/orchestrator.js'
import { getModelInfo } from '../models/registry.js'
import type { Session } from '../types.js'

const router = Router()

// In-memory event emitters per session for SSE
const sessionEmitters = new Map<string, EventEmitter>()
const sessionPdfTexts = new Map<string, string>()
const sessionReports = new Map<string, string>()

function getOrCreateEmitter(sessionId: string): EventEmitter {
  if (!sessionEmitters.has(sessionId)) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(20)
    sessionEmitters.set(sessionId, emitter)
  }
  return sessionEmitters.get(sessionId)!
}

// POST /api/intent - classify input before session creation (called from Home page)
router.post('/api/intent', async (req, res) => {
  const { input } = req.body as { input: string }
  if (!input?.trim()) {
    res.status(400).json({ error: 'input is required' })
    return
  }
  try {
    const result = await classifyInput(input.trim())
    res.json(result)
  } catch {
    // Fail open — never block a user from researching
    res.json({ classification: 'research', reply: '' })
  }
})

// POST /api/sessions - create new session
router.post('/api/sessions', async (req, res) => {
  const { input, inputType, maxDepth = 2, pdfText } = req.body as {
    input: string
    inputType: string
    maxDepth?: number
    pdfText?: string
  }

  if (!input) {
    res.status(400).json({ error: 'input is required' })
    return
  }

  const session: Session = {
    id: uuidv4(),
    input,
    inputType: (inputType || 'topic') as Session['inputType'],
    status: 'running',
    maxDepth: Math.min(Math.max(1, maxDepth), 5),
    createdAt: new Date().toISOString()
  }

  await createSession(session)

  if (pdfText) {
    sessionPdfTexts.set(session.id, pdfText)
  }

  res.json(session)
})

// GET /api/sessions/:id/stream - SSE connection
router.get('/api/sessions/:id/stream', (req, res) => {
  const { id } = req.params

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  const emitter = getOrCreateEmitter(id)

  function sendSSE(type: string, data: unknown) {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`)
    if ('flush' in res && typeof (res as { flush?: () => void }).flush === 'function') {
      (res as { flush: () => void }).flush()
    }
  }

  const onEvent = (type: string, data: unknown) => sendSSE(type, data)
  emitter.on('event', onEvent)

  const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 30000)

  req.on('close', () => {
    clearInterval(heartbeat)
    emitter.off('event', onEvent)
  })
})

// POST /api/sessions/:id/start - trigger research workflow
router.post('/api/sessions/:id/start', async (req, res) => {
  const { id } = req.params
  const session = await getSession(id)

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  const emitter = getOrCreateEmitter(id)
  const sendEvent = (type: string, data: unknown) => emitter.emit('event', type, data)
  const pdfText = sessionPdfTexts.get(id)

  runResearchWorkflow({
    sessionId: id,
    input: session.input,
    inputType: session.inputType,
    pdfText,
    maxDepth: session.maxDepth,
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    ollamaUrl: env.OLLAMA_BASE_URL,
    semanticScholarKey: env.SEMANTIC_SCHOLAR_API_KEY,
    sendEvent
  }).then(async ({ summary, clarifyingQuestions, papersCount, reportMarkdown, graphData }) => {
    await updateSessionStatus(id, 'completed')

    // Build and save welcome message first
    const welcomeMsgId = uuidv4()
    const questionsText = clarifyingQuestions.length > 0
      ? `\n\nTo help focus our exploration, I have a few questions:\n${clarifyingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : ''
    const welcomeContent = `I've finished analyzing the research. Here's a summary:\n\n**${summary}**${questionsText}\n\nFeel free to ask me anything about the papers, request a full report, or explore a specific angle.`

    await saveMessage({
      id: welcomeMsgId,
      sessionId: id,
      role: 'assistant',
      content: welcomeContent,
      createdAt: new Date().toISOString()
    })

    // Stream welcome message token-by-token would be ideal but a single token works fine
    sendEvent('token', { text: welcomeContent, phase: 'welcome', msgId: welcomeMsgId })
    sendEvent('message_done', { msgId: welcomeMsgId })

    // Send 'done' LAST — after welcome message so frontend doesn't miss it
    sendEvent('done', { papersCount, reportMarkdown, graphData })
  }).catch(async err => {
    console.error('Workflow error:', err)
    await updateSessionStatus(id, 'error')
    sendEvent('error', { message: err instanceof Error ? err.message : 'Unknown error' })
    sendEvent('done', { papersCount: 0, reportMarkdown: '', graphData: { nodes: [], edges: [] } })
  })

  res.json({ started: true })
})

// POST /api/sessions/:id/message - send a message
router.post('/api/sessions/:id/message', async (req, res) => {
  const { id } = req.params
  const { message } = req.body as { message: string }

  if (!message) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  const session = await getSession(id)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  const msgId = uuidv4()

  await saveMessage({
    id: uuidv4(),
    sessionId: id,
    role: 'user',
    content: message,
    createdAt: new Date().toISOString()
  })

  const papers = await getPapersForSession(id)
  const hasActivePapers = papers.length > 0

  let intent: 'research' | 'doubt' | 'report' | 'chat' = 'doubt'
  try {
    intent = await detectIntent(message, hasActivePapers)
  } catch {
    intent = hasActivePapers ? 'doubt' : 'research'
  }

  const emitter = getOrCreateEmitter(id)
  const sendEvent = (type: string, data: unknown) => emitter.emit('event', type, data)

  const conversationHistory = (await getMessagesForSession(id)).map(m => ({
    role: m.role,
    content: m.content
  }))

  const assistantMsgId = uuidv4()
  let assistantContent = ''

  if (intent === 'chat') {
    runChat({
      message,
      conversationHistory,
      hasPapers: hasActivePapers,
      onToken: (t) => {
        assistantContent += t
        sendEvent('token', { text: t, phase: 'tutor', msgId: assistantMsgId })
      }
    }).then(async () => {
      await saveMessage({
        id: assistantMsgId,
        sessionId: id,
        role: 'assistant',
        content: assistantContent,
        createdAt: new Date().toISOString()
      })
      sendEvent('message_done', { msgId: assistantMsgId })
    }).catch(err => {
      console.error('Chat error:', err)
      sendEvent('error', { message: 'Failed to respond' })
    })
  } else if (intent === 'doubt') {
    runTutor({
      sessionId: id,
      question: message,
      conversationHistory,
      papers: papers.map(p => ({ id: p.id, title: p.title, authors: p.authors, year: p.year })),
      ollamaUrl: env.OLLAMA_BASE_URL,
      onToken: (t) => {
        assistantContent += t
        sendEvent('token', { text: t, phase: 'tutor', msgId: assistantMsgId })
      },
      onSectionRef: (section, page) => {
        sendEvent('section_ref', { section, page })
      }
    }).then(async () => {
      await saveMessage({
        id: assistantMsgId,
        sessionId: id,
        role: 'assistant',
        content: assistantContent,
        createdAt: new Date().toISOString()
      })
      sendEvent('message_done', { msgId: assistantMsgId })
    }).catch(err => {
      console.error('Tutor error:', err)
      sendEvent('error', { message: 'Failed to get answer' })
    })
  } else if (intent === 'report') {
    const existingReport = sessionReports.get(id)
    if (existingReport) {
      sendEvent('token', { text: existingReport, phase: 'report', msgId: assistantMsgId })
      sendEvent('message_done', { msgId: assistantMsgId })
      await saveMessage({
        id: assistantMsgId,
        sessionId: id,
        role: 'assistant',
        content: existingReport,
        createdAt: new Date().toISOString()
      })
    } else {
      runReport({
        sessionId: id,
        papers,
        synthesis: '',
        goalConcepts: [session.input],
        onToken: (t) => {
          assistantContent += t
          sendEvent('token', { text: t, phase: 'report', msgId: assistantMsgId })
        }
      }).then(async (result) => {
        sessionReports.set(id, result.reportMarkdown)
        await saveMessage({
          id: assistantMsgId,
          sessionId: id,
          role: 'assistant',
          content: result.reportMarkdown,
          createdAt: new Date().toISOString()
        })
        sendEvent('graph_update', result.graphData)
        sendEvent('message_done', { msgId: assistantMsgId })
      }).catch(err => {
        console.error('Report error:', err)
        sendEvent('error', { message: 'Failed to generate report' })
      })
    }
  } else {
    runResearchWorkflow({
      sessionId: id,
      input: message,
      inputType: 'topic',
      maxDepth: 1,
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
      ollamaUrl: env.OLLAMA_BASE_URL,
      semanticScholarKey: env.SEMANTIC_SCHOLAR_API_KEY,
      sendEvent
    }).then(async (result) => {
      const content = result.reportMarkdown ||
        `Research complete. Found ${result.papersCount} papers.\n\n${result.summary}`
      await saveMessage({
        id: assistantMsgId,
        sessionId: id,
        role: 'assistant',
        content,
        createdAt: new Date().toISOString()
      })
      sendEvent('message_done', { msgId: assistantMsgId })
    }).catch(err => {
      console.error('Research workflow error:', err)
      sendEvent('error', { message: 'Research failed' })
    })
  }

  res.json({ messageId: msgId, intent })
})

// GET /api/sessions/:id/papers
router.get('/api/sessions/:id/papers', async (req, res) => {
  const papers = await getPapersForSession(req.params.id)
  res.json(papers)
})

// GET /api/sessions/:id/messages
router.get('/api/sessions/:id/messages', async (req, res) => {
  const messages = await getMessagesForSession(req.params.id)
  res.json(messages)
})

// GET /api/sessions/:id/report
router.get('/api/sessions/:id/report', (req, res) => {
  const markdown = sessionReports.get(req.params.id) || ''
  res.json({ markdown })
})

// GET /api/sessions/:id
router.get('/api/sessions/:id', async (req, res) => {
  const session = await getSession(req.params.id)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  res.json(session)
})

// GET /api/models - return model assignments per role
router.get('/api/models', (_req, res) => {
  const roles = ['planner', 'retriever', 'reasoning', 'tutor', 'report', 'orchestrator'] as const
  const result: Record<string, unknown> = {}
  for (const role of roles) {
    const info = getModelInfo(role)
    if (info) result[role] = info
  }
  res.json(result)
})

export default router
