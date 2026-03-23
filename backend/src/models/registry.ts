/**
 * Dynamic model registry.
 * At startup, fetches all available Gemini models, scores them per agent role,
 * and assigns the best available model. Never hardcodes model names.
 */
import { google } from '@ai-sdk/google'
import type { LanguageModelV1 } from '@ai-sdk/provider'

export type AgentRole = 'planner' | 'retriever' | 'reasoning' | 'tutor' | 'report' | 'orchestrator'

interface RawModel {
  name: string
  displayName?: string
  description?: string
  inputTokenLimit?: number
  outputTokenLimit?: number
  supportedGenerationMethods?: string[]
}

export interface ModelInfo {
  id: string              // e.g. "gemini-2.5-pro"
  displayName: string
  inputTokenLimit: number
  outputTokenLimit: number
  hasThinking: boolean    // inferred: outputTokenLimit >= 65536
  isLite: boolean
  isPro: boolean
  isFlash: boolean
  isPreview: boolean
  isAlias: boolean        // e.g. gemini-pro-latest
  generation: number      // 2.0, 2.5, 3.0, 3.1 — parsed from name
}

// Role requirements — describes what each agent needs most
const ROLE_WEIGHTS: Record<AgentRole, {
  thinking: number
  longOutput: number
  longInput: number
  speed: number      // prefer lite/flash
  stability: number  // prefer non-preview
  pro: number        // prefer pro over flash
}> = {
  planner: {
    thinking: 40,   // must reason about research goals
    longOutput: 20, // needs to return detailed JSON plan
    longInput: 5,
    speed: 5,
    stability: 20,
    pro: 20
  },
  reasoning: {
    thinking: 40,   // synthesis across many papers
    longOutput: 30, // detailed synthesis text
    longInput: 25,  // must hold multiple papers
    speed: 0,
    stability: 15,
    pro: 20
  },
  tutor: {
    thinking: 35,   // nuanced, grounded explanations
    longOutput: 25, // detailed answers
    longInput: 25,  // full paper in context
    speed: 5,
    stability: 20,
    pro: 20
  },
  report: {
    thinking: 20,
    longOutput: 35, // large reports need high output limit
    longInput: 10,
    speed: 10,
    stability: 25,
    pro: 10
  },
  retriever: {
    thinking: 5,
    longOutput: 5,
    longInput: 5,
    speed: 50,      // fast extraction is key
    stability: 30,
    pro: 0
  },
  orchestrator: {
    thinking: 10,
    longOutput: 0,
    longInput: 0,
    speed: 60,      // just classifies intent — must be fast
    stability: 25,
    pro: 0
  }
}

function parseGeneration(id: string): number {
  const match = id.match(/gemini-(\d+(?:\.\d+)?)/)
  if (!match) return 1.0
  return parseFloat(match[1])
}

function parseModelInfo(raw: RawModel): ModelInfo | null {
  const id = raw.name.replace('models/', '')
  const methods = raw.supportedGenerationMethods ?? []

  // Only include models that support text generation
  if (!methods.includes('generateContent')) return null

  // Exclude non-text modalities
  if (['tts', 'audio', '-image', 'embedding', 'robotics', 'computer-use', 'aqa', 'veo', 'imagen'].some(x => id.includes(x))) return null

  // Exclude very old models
  if (id.startsWith('gemini-1.') || id.startsWith('gemma-')) return null

  const outputTokenLimit = raw.outputTokenLimit ?? 8192

  return {
    id,
    displayName: raw.displayName ?? id,
    inputTokenLimit: raw.inputTokenLimit ?? 32768,
    outputTokenLimit,
    hasThinking: outputTokenLimit >= 65536,       // all thinking models have 65K+ output
    isLite: id.includes('lite'),
    isPro: id.includes('pro') && !id.includes('flash'),
    isFlash: id.includes('flash'),
    isPreview: id.includes('preview') || id.includes('exp') || id.includes('latest'),
    isAlias: id.includes('latest'),
    generation: parseGeneration(id)
  }
}

function scoreModel(model: ModelInfo, role: AgentRole): number {
  const w = ROLE_WEIGHTS[role]
  let score = 0

  // Capability scores
  if (model.hasThinking) score += w.thinking
  if (model.outputTokenLimit >= 65536) score += w.longOutput
  if (model.inputTokenLimit >= 1000000) score += w.longInput
  if (model.isLite || (model.isFlash && !model.isPro)) score += w.speed
  if (!model.isPreview) score += w.stability
  if (model.isPro) score += w.pro

  // Generation bonus — newer is generally better
  score += model.generation * 3

  // Alias models (e.g. gemini-pro-latest) are always fresh but slightly less predictable
  if (model.isAlias) score -= 3

  return score
}

// Singleton assignments
const assignments = new Map<AgentRole, ModelInfo>()
let initialized = false

export async function initModelRegistry(apiKey: string): Promise<void> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    )
    if (!res.ok) throw new Error(`ListModels failed: ${res.status}`)

    const data = await res.json() as { models: RawModel[] }
    const models = data.models
      .map(parseModelInfo)
      .filter((m): m is ModelInfo => m !== null)

    console.log(`\n📋 Model Registry — ${models.length} eligible models found`)

    const roles: AgentRole[] = ['planner', 'retriever', 'reasoning', 'tutor', 'report', 'orchestrator']

    for (const role of roles) {
      const ranked = models
        .map(m => ({ model: m, score: scoreModel(m, role) }))
        .sort((a, b) => b.score - a.score)

      const best = ranked[0].model
      assignments.set(role, best)

      console.log(`  ${role.padEnd(14)} → ${best.id.padEnd(40)} (score: ${ranked[0].score}, thinking: ${best.hasThinking}, output: ${best.outputTokenLimit.toLocaleString()})`)
    }

    console.log('')
    initialized = true
  } catch (err) {
    console.error('Model registry init failed, using safe fallbacks:', err)
    useFallbacks()
  }
}

function useFallbacks() {
  const fallback = (id: string): ModelInfo => ({
    id,
    displayName: id,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    hasThinking: true,
    isLite: id.includes('lite'),
    isPro: id.includes('pro'),
    isFlash: id.includes('flash'),
    isPreview: false,
    isAlias: id.includes('latest'),
    generation: 2.5
  })

  assignments.set('planner',      fallback('gemini-2.5-pro'))
  assignments.set('reasoning',    fallback('gemini-2.5-pro'))
  assignments.set('tutor',        fallback('gemini-2.5-pro'))
  assignments.set('report',       fallback('gemini-2.5-flash'))
  assignments.set('retriever',    fallback('gemini-2.5-flash-lite'))
  assignments.set('orchestrator', fallback('gemini-2.5-flash-lite'))
  initialized = true
}

export function getAgentModel(role: AgentRole): LanguageModelV1 {
  if (!initialized) {
    console.warn(`Registry not initialized when requesting model for "${role}", using fallback`)
    useFallbacks()
  }
  const info = assignments.get(role)!
  return google(info.id) as LanguageModelV1
}

export function getModelInfo(role: AgentRole): ModelInfo | undefined {
  return assignments.get(role)
}
