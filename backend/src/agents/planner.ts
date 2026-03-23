import { generateText } from 'ai'
import { getAgentModel } from '../models/registry.js'

export async function runPlanner(input: string): Promise<{
  goalConcepts: string[]
  searchQueries: string[]
  priorityOrder: string[]
  summary: string
}> {
  const { text } = await generateText({
    model: getAgentModel('planner'),
    system: `You are a research planning agent. Analyze the given research input and create a structured research plan.
Output ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "goalConcepts": ["concept1", "concept2"],
  "searchQueries": ["query1", "query2", "query3"],
  "priorityOrder": ["most important concept first"],
  "summary": "one sentence summary of research goal"
}`,
    prompt: `Research input: ${input}`,
  })

  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return {
      goalConcepts: [input],
      searchQueries: [input],
      priorityOrder: [input],
      summary: `Research into: ${input}`
    }
  }
}
