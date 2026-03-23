import dotenv from 'dotenv'
dotenv.config()

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required environment variable: ${name}`)
  return val
}

export const env = {
  GOOGLE_GENERATIVE_AI_API_KEY: requireEnv('GOOGLE_GENERATIVE_AI_API_KEY'),
  SEMANTIC_SCHOLAR_API_KEY: process.env.SEMANTIC_SCHOLAR_API_KEY || '',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  PORT: parseInt(process.env.PORT || '3001', 10)
}
