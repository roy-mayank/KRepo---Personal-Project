import React, { useState, useCallback } from 'react'
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow'
import 'reactflow/dist/style.css'

// Component to render a learning path DAG using React Flow.
// `path` should be an object like { nodes: [ {id,title,prerequisites?,xp?}, ... ] }
export default function LearningFlow({ path }) {
  const [xpMap, setXpMap] = useState(() => {
    const m = {}
    path.nodes.forEach((n) => {
      m[n.id] = n.xp ?? 0
    })
    return m
  })

  const incrementXp = useCallback((id) => {
    setXpMap((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }))
  }, [])

  // convert to reactflow nodes and edges
  const nodes = path.nodes.map((n, idx) => ({
    id: n.id,
    data: {
      label: (
        <div className="flex flex-col items-start gap-1">
          <span className="font-semibold">{n.title}</span>
          <span className="text-xs text-muted-foreground">XP: {xpMap[n.id]}</span>
          <button className="text-xs underline" onClick={() => incrementXp(n.id)}>
            Add XP
          </button>
        </div>
      ),
    },
    position: { x: 0, y: idx * 100 }, // simple vertical layout; users can drag
    style: { width: 200 },
  }))

  const edges = []
  path.nodes.forEach((n) => {
    if (Array.isArray(n.prerequisites)) {
      n.prerequisites.forEach((pre) => {
        edges.push({
          id: `${pre}-${n.id}`,
          source: pre,
          target: n.id,
          markerEnd: {
            type: MarkerType.Arrow,
          },
        })
      })
    }
  })

  return (
    <div style={{ height: 400 }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
