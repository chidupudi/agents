import { runPlanner } from '../agents/planner.js'
import { runRetriever } from '../agents/retriever.js'
import { embedAndStorePaper } from '../agents/embedder.js'
import { runReasoning } from '../agents/reasoning.js'
import { runReport } from '../agents/report.js'
import { savePaper, getPapersForSession } from '../db/sessions.js'
import type { Paper, AgentStep, GraphNode, GraphEdge } from '../types.js'
import { v4 as uuidv4 } from 'uuid'

export async function runResearchWorkflow(params: {
  sessionId: string
  input: string
  inputType: string
  pdfText?: string
  maxDepth: number
  apiKey: string
  ollamaUrl: string
  semanticScholarKey: string
  sendEvent: (type: string, data: unknown) => void
}): Promise<void> {
  const { sessionId, input, pdfText, maxDepth, apiKey, ollamaUrl, semanticScholarKey, sendEvent } = params
  const allPapers: Paper[] = []
  const graphEdges: GraphEdge[] = []

  function sendStep(step: AgentStep) {
    sendEvent('agent_step', step)
  }

  // Step 1: Plan
  sendStep({ type: 'plan', status: 'running', message: 'Planning research strategy...' })

  let plan: { goalConcepts: string[]; searchQueries: string[]; priorityOrder: string[]; summary: string }
  try {
    // For PDFs: give the planner the actual paper content, not just the filename
    const planInput = pdfText
      ? `Analyze this research paper and create a research plan:\n\n${pdfText.slice(0, 8000)}`
      : input
    plan = await runPlanner(planInput)
  } catch (err) {
    console.error('Planner error:', err)
    plan = {
      goalConcepts: [input],
      searchQueries: [input],
      priorityOrder: [input],
      summary: `Research into: ${input}`
    }
  }

  sendStep({
    type: 'plan',
    status: 'done',
    message: `Research plan: ${plan.summary}`,
    data: { goalConcepts: plan.goalConcepts, searchQueries: plan.searchQueries }
  })

  // Cap to 2 queries per depth — free tier is 1 req/sec, keep it manageable
  let currentQueries = plan.searchQueries.slice(0, 2)
  let currentDepth = 0
  let synthesis = ''

  // Step 2: Iterative fetch + reason loop
  while (currentDepth <= maxDepth) {
    // Fetch papers
    sendStep({
      type: 'fetch',
      status: 'running',
      message: `Depth ${currentDepth}: Fetching papers for ${currentQueries.length} queries...`
    })

    let fetchedPapers: Paper[] = []
    try {
      fetchedPapers = await runRetriever(currentQueries, semanticScholarKey, sessionId)
    } catch (err) {
      console.error('Retriever error:', err)
    }

    // Score and filter papers
    const scoredPapers = fetchedPapers.map((p, i) => ({
      ...p,
      depth: currentDepth,
      relevanceScore: Math.max(0.1, 1.0 - i * 0.05 - currentDepth * 0.1),
      status: 'fetched' as const
    }))

    // Deduplicate against already collected papers
    const existingIds = new Set(allPapers.map(p => p.semanticScholarId))
    const newPapers = scoredPapers.filter(p => !existingIds.has(p.semanticScholarId))

    sendStep({
      type: 'fetch',
      status: 'done',
      message: `Found ${newPapers.length} new papers at depth ${currentDepth}`
    })

    // Save and broadcast each paper
    for (const paper of newPapers) {
      allPapers.push(paper)
      await savePaper(paper)
      sendEvent('paper_found', paper)

      // Update graph
      const graphNode: GraphNode = {
        id: paper.id,
        title: paper.title,
        year: paper.year,
        citationCount: paper.citationCount,
        relevanceScore: paper.relevanceScore,
        depth: paper.depth,
        status: paper.status
      }

      // Create edges from depth-1 papers to depth-0 papers
      if (currentDepth > 0 && allPapers.length > 0) {
        const parentPapers = allPapers.filter(p => p.depth === currentDepth - 1)
        if (parentPapers.length > 0) {
          const parentIdx = Math.floor(Math.random() * parentPapers.length)
          const edge: GraphEdge = { source: parentPapers[parentIdx].id, target: paper.id }
          graphEdges.push(edge)
        }
      }

      sendEvent('graph_update', {
        nodes: allPapers.map(p => ({
          id: p.id,
          title: p.title,
          year: p.year,
          citationCount: p.citationCount,
          relevanceScore: p.relevanceScore,
          depth: p.depth,
          status: p.status
        })),
        edges: graphEdges
      })
    }

    // Embed papers
    sendStep({ type: 'embed', status: 'running', message: `Embedding ${newPapers.length} papers...` })

    const relevantPapers = newPapers.filter(p => p.relevanceScore > 0.3)
    for (const paper of relevantPapers.slice(0, 10)) {
      try {
        await embedAndStorePaper({ paper, sessionId, ollamaUrl })
      } catch (err) {
        console.error('Embedding error for paper:', paper.title, err)
      }
    }

    sendStep({ type: 'embed', status: 'done', message: `Embedded ${relevantPapers.slice(0, 10).length} papers` })

    // Reason
    if (allPapers.length > 0) {
      sendStep({ type: 'reason', status: 'running', message: 'Synthesizing findings...' })

      let reasoning: { synthesis: string; gaps: string[]; shouldContinue: boolean }
      try {
        reasoning = await runReasoning({
          sessionId,
          goalConcepts: plan.goalConcepts,
          papers: allPapers,
          ollamaUrl,
          onToken: (t) => sendEvent('token', { text: t, phase: 'reasoning' })
        })
        synthesis = reasoning.synthesis
      } catch (err) {
        console.error('Reasoning error:', err)
        reasoning = { synthesis: 'Unable to synthesize at this time.', gaps: [], shouldContinue: false }
      }

      sendStep({
        type: 'reason',
        status: 'done',
        message: `Synthesis complete. Found ${reasoning.gaps.length} gaps.`,
        data: { gaps: reasoning.gaps }
      })

      // Check if we should continue
      if (!reasoning.shouldContinue || currentDepth >= maxDepth) {
        break
      }

      // Update queries from gaps for next iteration
      currentQueries = reasoning.gaps.slice(0, 2)
    }

    currentDepth++
  }

  // Generate report
  sendStep({ type: 'report', status: 'running', message: 'Generating research report...' })

  let reportMarkdown = ''
  let graphData: { nodes: GraphNode[]; edges: GraphEdge[] } = { nodes: [], edges: [] }

  try {
    const result = await runReport({
      sessionId,
      papers: allPapers,
      synthesis,
      goalConcepts: plan.goalConcepts,
      onToken: (t) => sendEvent('token', { text: t, phase: 'report' })
    })
    reportMarkdown = result.reportMarkdown
    graphData = result.graphData
  } catch (err) {
    console.error('Report error:', err)
    reportMarkdown = `# Research Report\n\nFound ${allPapers.length} papers.\n\n${synthesis}`
    graphData = {
      nodes: allPapers.map(p => ({
        id: p.id,
        title: p.title,
        year: p.year,
        citationCount: p.citationCount,
        relevanceScore: p.relevanceScore,
        depth: p.depth,
        status: p.status
      })),
      edges: graphEdges
    }
  }

  sendStep({ type: 'report', status: 'done', message: 'Report generated successfully' })

  sendEvent('done', {
    papersCount: allPapers.length,
    reportMarkdown,
    graphData
  })
}
