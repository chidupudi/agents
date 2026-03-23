export async function resolveDOI(doi: string): Promise<{ title: string; semanticScholarId?: string } | null> {
  try {
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, '')
    const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AcademicResearchDetective/1.0 (mailto:research@example.com)' }
    })
    if (!response.ok) return null

    const data = await response.json() as {
      message?: {
        title?: string[]
        'alternative-id'?: string[]
      }
    }

    const message = data.message
    if (!message) return null

    const titleArr = message.title ?? []
    const title = titleArr[0] ?? 'Unknown Title'

    return { title }
  } catch (err) {
    console.error('resolveDOI error:', err)
    return null
  }
}
