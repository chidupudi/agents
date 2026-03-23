import { env } from './env.js'

// Set API key for @ai-sdk/google before any imports
process.env.GOOGLE_GENERATIVE_AI_API_KEY = env.GOOGLE_GENERATIVE_AI_API_KEY

import express from 'express'
import cors from 'cors'
import { initSessionsDb } from './db/sessions.js'
import { initVectorDb } from './db/vector.js'
import { initModelRegistry } from './models/registry.js'
import sessionRouter from './routes/session.js'
import libraryRouter from './routes/library.js'

const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '50mb' }))

app.use(sessionRouter)
app.use(libraryRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

async function main() {
  await initModelRegistry(env.GOOGLE_GENERATIVE_AI_API_KEY)
  await initSessionsDb()
  await initVectorDb()
  app.listen(env.PORT, () => {
    console.log(`Academic Research Detective backend running on http://localhost:${env.PORT}`)
  })
}

main().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
