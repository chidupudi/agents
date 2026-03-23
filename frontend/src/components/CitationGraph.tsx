import { useEffect, useState, useCallback } from 'react'
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider
} from '@xyflow/react'
import dagre from 'dagre'
import type { GraphNode, GraphEdge } from '../types'

import '@xyflow/react/dist/style.css'

interface CitationGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const nodeWidth = 180
const nodeHeight = 80

function statusColor(status: string): string {
  switch (status) {
    case 'root': return '#1e3a5f'
    case 'fetched': return '#022c0e'
    case 'queued': return '#1c1500'
    case 'skipped': return '#1a1a1a'
    default: return '#1e2535'
  }
}

function statusBorder(status: string): string {
  switch (status) {
    case 'root': return '#3b82f6'
    case 'fetched': return '#22c55e'
    case 'queued': return '#eab308'
    case 'skipped': return '#374151'
    default: return '#2d3147'
  }
}

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 70, ranksep: 70 })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach(node => g.setNode(node.id, { width: nodeWidth, height: nodeHeight }))
  edges.forEach(edge => {
    if (edge.source && edge.target) {
      g.setEdge(edge.source, edge.target)
    }
  })

  dagre.layout(g)

  return nodes.map(node => {
    const pos = g.node(node.id)
    if (!pos) return node
    return { ...node, position: { x: pos.x - nodeWidth / 2, y: pos.y - nodeHeight / 2 } }
  })
}

function CitationGraphInner({ nodes: graphNodes, edges: graphEdges }: CitationGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const buildFlow = useCallback(() => {
    if (graphNodes.length === 0) return

    const flowNodes: Node[] = graphNodes.map(gn => ({
      id: gn.id,
      type: 'default',
      position: { x: 0, y: 0 },
      data: {
        label: (
          <div style={{ textAlign: 'center', padding: '4px' }}>
            <div style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: '#e2e8f0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: '3px',
              maxWidth: '160px'
            }}>
              {gn.title.length > 35 ? gn.title.slice(0, 35) + '…' : gn.title}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
              {gn.year > 0 ? gn.year : '?'} · {gn.citationCount.toLocaleString()} cites
            </div>
          </div>
        )
      },
      style: {
        background: statusColor(gn.status),
        border: `1px solid ${statusBorder(gn.status)}`,
        borderRadius: '8px',
        width: nodeWidth,
        minHeight: nodeHeight,
        color: '#e2e8f0'
      }
    }))

    const flowEdges: Edge[] = graphEdges.map((ge, i) => ({
      id: `e-${ge.source}-${ge.target}-${i}`,
      source: ge.source,
      target: ge.target,
      style: { stroke: '#2d3147', strokeWidth: 1.5 },
      markerEnd: { type: 'arrowclosed' as const, color: '#2d3147' }
    }))

    const laidOutNodes = applyDagreLayout(flowNodes, flowEdges)
    setNodes(laidOutNodes)
    setEdges(flowEdges)
  }, [graphNodes, graphEdges, setNodes, setEdges])

  useEffect(() => {
    buildFlow()
  }, [buildFlow])

  return (
    <div style={{ width: '100%', height: '100%', background: '#0f1117' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        style={{ background: '#0f1117' }}
        proOptions={{ hideAttribution: true }}
      >
        <Controls style={{ background: '#1a1d27', border: '1px solid #2d3147' }} />
        <MiniMap
          style={{ background: '#1a1d27', border: '1px solid #2d3147' }}
          nodeColor={node => {
            const status = (node.data as { status?: string }).status || 'fetched'
            return statusBorder(status)
          }}
        />
        <Background color="#2d3147" gap={20} size={0.5} />
      </ReactFlow>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        background: '#1a1d27',
        border: '1px solid #2d3147',
        borderRadius: '8px',
        padding: '10px',
        fontSize: '0.7rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        pointerEvents: 'none',
        zIndex: 10
      }}>
        {[
          { label: 'Root', color: '#3b82f6' },
          { label: 'Fetched', color: '#22c55e' },
          { label: 'Queued', color: '#eab308' },
          { label: 'Skipped', color: '#374151' }
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CitationGraph(props: CitationGraphProps) {
  return (
    <ReactFlowProvider>
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <CitationGraphInner {...props} />
      </div>
    </ReactFlowProvider>
  )
}
