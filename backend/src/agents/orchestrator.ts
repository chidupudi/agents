import { generateText } from 'ai'
import { getAgentModel } from '../models/registry.js'

/**
 * Classifies raw user input BEFORE a session is created.
 * Used on the Home page to decide whether to start a research session
 * or respond conversationally inline.
 */
export async function classifyInput(input: string): Promise<{
  classification: 'research' | 'conversation' | 'unclear'
  reply: string
}> {
  try {
    const { text } = await generateText({
      model: getAgentModel('orchestrator'),
      system: `You are an input classifier for an academic research assistant.

Analyze the user's input and classify it:
- "research": A genuine research query — a topic, concept, domain, scientific question, paper title, DOI, or URL. Even single-word topics like "CRISPR" or vague areas like "AI safety" count as research.
- "conversation": A greeting, casual message, off-topic question, or inquiry about what the assistant does (e.g. "hi", "hello", "what can you do", "how does this work", "thanks").
- "unclear": Truly ambiguous — you genuinely cannot determine intent.

For "conversation" inputs, write a brief warm reply (1-2 sentences) that redirects to the assistant's capabilities.
For "research" and "unclear", reply should be an empty string.

Output ONLY valid JSON, no markdown:
{
  "classification": "research|conversation|unclear",
  "reply": "conversational reply if applicable, else empty string"
}`,
      prompt: `Input: "${input}"`
    })

    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const result = JSON.parse(cleaned) as { classification: string; reply: string }
    const valid = ['research', 'conversation', 'unclear'] as const
    const classification = valid.includes(result.classification as typeof valid[number])
      ? (result.classification as typeof valid[number])
      : 'research'
    return { classification, reply: result.reply || '' }
  } catch {
    // On any failure, assume research — never silently block a legitimate query
    return { classification: 'research', reply: '' }
  }
}

export async function detectIntent(
  message: string,
  hasActivePapers: boolean
): Promise<'research' | 'doubt' | 'report' | 'chat'> {
  try {
    const { text } = await generateText({
      model: getAgentModel('orchestrator'),
      system: `You are an intent classifier for an academic research assistant.
Classify the user's message into exactly one of these categories:
- "chat": Casual conversation, greetings, acknowledgements, or off-topic messages. Examples: "hi", "hello", "thanks", "ok", "cool", "how are you", "what can you do", "nice", "great", "bye"
- "doubt": User is asking about specific content, concepts, or details in the papers. Examples: "what does this mean?", "explain X", "how does Y work?", "what is the difference between..."
- "report": User wants a summary, report, overview, or synthesis of research. Examples: "give me a report", "summarize", "write a summary", "what did you find?"
- "research": User wants to find more papers or research a new/different topic. Examples: "find more papers about", "search for", "explore", "look for papers on", "what else is there about"

Output ONLY one word: chat, doubt, report, or research`,
      prompt: `User message: "${message}"\nHas active papers: ${hasActivePapers}`
    })

    const cleaned = text.trim().toLowerCase()
    if (cleaned === 'chat' || cleaned === 'doubt' || cleaned === 'report' || cleaned === 'research') {
      return cleaned
    }
    return hasActivePapers ? 'doubt' : 'research'
  } catch {
    return hasActivePapers ? 'doubt' : 'research'
  }
}
