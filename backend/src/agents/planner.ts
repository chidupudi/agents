import { generateText } from 'ai'
import { getAgentModel } from '../models/registry.js'

export async function runPlanner(input: string): Promise<{
  goalConcepts: string[]
  searchQueries: string[]
  priorityOrder: string[]
  summary: string
  clarifyingQuestions: string[]
}> {
  const { text } = await generateText({
    model: getAgentModel('planner'),
    system: `You are a research planning agent. Analyze the given research input and create a structured research plan.
Output ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "goalConcepts": ["concept1", "concept2"],
  "searchQueries": ["query1", "query2", "query3"],
  "priorityOrder": ["most important concept first"],
  "summary": "one sentence summary of research goal",
  "clarifyingQuestions": [
    "specific question to understand what aspect the user most wants to explore?",
    "question about their background or use case?",
    "question about scope or depth they need?"
  ]
}
The clarifyingQuestions should be 2-3 insightful questions that would help focus the research on what matters most to the user.`,
    prompt: `Research input: ${input}`,
  })

  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const result = JSON.parse(cleaned)
    if (!Array.isArray(result.clarifyingQuestions)) result.clarifyingQuestions = []
    return result
  } catch {
    return {
      goalConcepts: [input],
      searchQueries: [input],
      priorityOrder: [input],
      summary: `Research into: ${input}`,
      clarifyingQuestions: []
    }
  }
}
