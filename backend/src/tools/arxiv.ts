export async function getArxivAbstract(arxivId: string): Promise<string> {
  try {
    const cleanId = arxivId.replace(/^arxiv:/i, '')
    const url = `https://export.arxiv.org/abs/${cleanId}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AcademicResearchDetective/1.0' }
    })
    if (!response.ok) return ''

    const html = await response.text()

    // Extract abstract from the HTML
    const abstractMatch = html.match(/<blockquote[^>]*class="[^"]*abstract[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i)
    if (abstractMatch) {
      return abstractMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/Abstract:\s*/i, '')
        .trim()
    }

    // Fallback: try meta description
    const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
    if (metaMatch) return metaMatch[1].trim()

    return ''
  } catch (err) {
    console.error('getArxivAbstract error:', err)
    return ''
  }
}
