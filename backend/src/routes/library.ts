import { Router } from 'express'
import { getAllSessions } from '../db/sessions.js'

const router = Router()

router.get('/api/sessions', async (_req, res) => {
  const sessions = await getAllSessions()
  res.json(sessions)
})

export default router
