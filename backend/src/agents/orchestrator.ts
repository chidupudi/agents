import { generateText } from 'ai'
import { getAgentModel } from '../models/registry.js'

export async function detectIntent(
  message: string,
  hasActivePapers: boolean
): Promise<'research' | 'doubt' | 'report'> {
  try {
    const { text } = await generateText({
      model: getAgentModel('orchestrator'),
      system: `You are an intent classifier for an academic research assistant.
Classify the user's message into exactly one of these categories:
- "doubt": User is asking about specific content, concepts, or details in the papers they've read. Questions like "what does this mean?", "explain X", "how does Y work?", "what is the difference between..."
- "report": User wants a summary, report, overview, or synthesis of all research. Phrases like "give me a report", "summarize", "write a summary", "what did you find?"
- "research": User wants to explore more papers, find related work, or research a new topic. Phrases like "find more papers about", "what else is there about", "explore", "look for papers on"

Output ONLY one word: doubt, report, or research`,
      prompt: `User message: "${message}"\nHas active papers: ${hasActivePapers}`
    })

    const cleaned = text.trim().toLowerCase()
    if (cleaned === 'doubt' || cleaned === 'report' || cleaned === 'research') {
      return cleaned
    }
    // Default based on context
    return hasActivePapers ? 'doubt' : 'research'
  } catch {
    return hasActivePapers ? 'doubt' : 'research'
  }
}
