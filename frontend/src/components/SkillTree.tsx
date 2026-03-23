import { useState, useMemo, useEffect } from 'react'
import { Lock, Circle, Zap, CheckCircle } from 'lucide-react'
import type { LearningPath, LearningPathNode } from '@/lib/queries'

const NODE_W = 176
const NODE_H = 82
const H_GAP = 36
const V_GAP = 60

type NodeStatus = 'locked' | 'available' | 'active' | 'done'

interface NodePosition {
  x: number
  y: number
}

interface LayoutResult {
  positions: Record<string, NodePosition>
  canvasW: number
  canvasH: number
}

interface EdgeData {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  my: number
  src: string
}

interface SkillTreeProps {
  path: LearningPath
  taskId: string
}

interface NodeIconProps {
  status: NodeStatus
}

function computeLayout(nodes: LearningPathNode[]): LayoutResult {
  const levelOf: Record<string, number> = Object.fromEntries(nodes.map((n) => [n.id, 0]))

  // Relax levels: each node sits one level below its deepest prerequisite
  for (let pass = 0; pass < nodes.length; pass++) {
    nodes.forEach((n) => {
      ;(n.prerequisites || []).forEach((pre) => {
        if (levelOf[pre] != null) {
          levelOf[n.id] = Math.max(levelOf[n.id], levelOf[pre] + 1)
        }
      })
    })
  }

  const byLevel: Record<number, LearningPathNode[]> = {}
  nodes.forEach((n) => {
    const l = levelOf[n.id]
    ;(byLevel[l] = byLevel[l] || []).push(n)
  })

  const maxCols = Math.max(...Object.values(byLevel).map((a) => a.length))
  const canvasW = Math.max(maxCols * (NODE_W + H_GAP) - H_GAP, NODE_W)

  const positions: Record<string, NodePosition> = {}
  let y = 0
  Object.keys(byLevel)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((level) => {
      const row = byLevel[level]
      const rowW = row.length * (NODE_W + H_GAP) - H_GAP
      const startX = (canvasW - rowW) / 2
      row.forEach((n, i) => {
        positions[n.id] = { x: startX + i * (NODE_W + H_GAP), y }
      })
      y += NODE_H + V_GAP
    })

  return { positions, canvasW, canvasH: y - V_GAP + NODE_H }
}

// -- Styling maps --
const NODE_STYLE: Record<NodeStatus, string> = {
  locked: 'border-zinc-700/50 bg-zinc-900/60 text-zinc-600 cursor-default',
  available:
    'border-indigo-500/70 bg-zinc-900 text-zinc-100 cursor-pointer hover:border-indigo-400 hover:bg-zinc-800/80',
  active: 'border-amber-400 bg-amber-500/10 text-zinc-100 cursor-pointer hover:bg-amber-500/20',
  done: 'border-green-500 bg-green-500/10 text-zinc-100 cursor-pointer hover:bg-green-500/20',
}

const EDGE_COLOR: Record<NodeStatus, string> = {
  locked: 'rgba(63,63,70,0.5)', // zinc-700
  available: 'rgba(99,102,241,0.55)', // indigo
  active: 'rgba(251,191,36,0.6)', // amber
  done: 'rgba(34,197,94,0.6)', // green
}

function NodeIcon({ status }: NodeIconProps) {
  if (status === 'locked') return <Lock className="h-3 w-3 shrink-0 text-zinc-600" />
  if (status === 'available') return <Circle className="h-3 w-3 shrink-0 text-indigo-400" />
  if (status === 'active') return <Zap className="h-3 w-3 shrink-0 text-amber-400" />
  return <CheckCircle className="h-3 w-3 shrink-0 text-green-400" />
}

export default function SkillTree({ path, taskId }: SkillTreeProps) {
  const nodes = path?.nodes || []
  const storageKey = `skill_tree_${taskId}`

  const [progress, setProgress] = useState<Record<string, NodeStatus>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}') as Record<string, NodeStatus>
    } catch {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(progress))
  }, [progress, storageKey])

  // Derived display status for each node
  const statusOf = useMemo<Record<string, NodeStatus>>(() => {
    const s: Record<string, NodeStatus> = {}
    nodes.forEach((n) => {
      const prereqsDone = (n.prerequisites || []).every((p) => progress[p] === 'done')
      const stored = progress[n.id]
      if (stored === 'done') s[n.id] = 'done'
      else if (stored === 'active' && prereqsDone) s[n.id] = 'active'
      else if (prereqsDone) s[n.id] = 'available'
      else s[n.id] = 'locked'
    })
    return s
  }, [nodes, progress])

  const handleClick = (nodeId: string) => {
    const s = statusOf[nodeId]
    if (s === 'locked') return
    setProgress((prev) => {
      const next = { ...prev }
      if (s === 'available') next[nodeId] = 'active'
      else if (s === 'active') next[nodeId] = 'done'
      else if (s === 'done') delete next[nodeId]
      return next
    })
  }

  const { positions, canvasW, canvasH } = useMemo(() => computeLayout(nodes), [nodes])

  // SVG edges -- bezier from bottom-centre of parent to top-centre of child
  const edges = useMemo<EdgeData[]>(() => {
    const result: EdgeData[] = []
    nodes.forEach((n) => {
      ;(n.prerequisites || []).forEach((pre) => {
        const pPos = positions[pre]
        const nPos = positions[n.id]
        if (!pPos || !nPos) return
        const x1 = pPos.x + NODE_W / 2
        const y1 = pPos.y + NODE_H
        const x2 = nPos.x + NODE_W / 2
        const y2 = nPos.y
        const my = (y1 + y2) / 2
        result.push({ id: `${pre}->${n.id}`, x1, y1, x2, y2, my, src: pre })
      })
    })
    return result
  }, [nodes, positions])

  // Progress stats
  const total = nodes.length
  const done = nodes.filter((n) => progress[n.id] === 'done').length
  const active = nodes.filter((n) => progress[n.id] === 'active').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No learning path available.</p>
    )
  }

  return (
    <div className="flex h-full min-h-0 gap-3">
      {/* Scrollable tree canvas */}
      <div className="flex-1 overflow-auto rounded-lg">
        <div
          className="relative mx-auto"
          style={{ width: canvasW, height: canvasH, minWidth: '100%' }}
        >
          {/* Edges */}
          <svg className="pointer-events-none absolute inset-0" width={canvasW} height={canvasH}>
            {edges.map((e) => (
              <path
                key={e.id}
                d={`M ${e.x1} ${e.y1} C ${e.x1} ${e.my} ${e.x2} ${e.my} ${e.x2} ${e.y2}`}
                fill="none"
                stroke={EDGE_COLOR[statusOf[e.src] as NodeStatus] ?? EDGE_COLOR.locked}
                strokeWidth={1.5}
              />
            ))}
          </svg>

          {/* Nodes */}
          {nodes.map((n) => {
            const pos = positions[n.id] || { x: 0, y: 0 }
            const s = statusOf[n.id]
            return (
              <div
                key={n.id}
                className={`absolute rounded-lg border px-3 py-2 transition-all duration-150 select-none ${NODE_STYLE[s]}`}
                style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H }}
                onClick={() => handleClick(n.id)}
                title={s === 'locked' ? 'Complete prerequisites to unlock' : 'Click to advance'}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <NodeIcon status={s} />
                  <span className="truncate text-xs font-semibold leading-tight">{n.title}</span>
                </div>
                <p className="line-clamp-2 text-[11px] leading-tight opacity-70">{n.description}</p>
                {n.xp > 0 && (
                  <span className="absolute bottom-1.5 right-2 text-[10px] opacity-40">
                    {n.xp} XP
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Progress sidebar */}
      <div className="flex w-14 shrink-0 flex-col items-center gap-2 py-1">
        {/* Percentage label */}
        <span className="text-xs font-bold text-zinc-300">{pct}%</span>

        {/* Vertical bar -- fills from bottom */}
        <div className="relative flex-1 w-3 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="absolute bottom-0 left-0 w-full rounded-full bg-green-500 transition-all duration-500"
            style={{ height: `${pct}%` }}
          />
          {/* Active indicator layer */}
          {active > 0 && (
            <div
              className="absolute bottom-0 left-0 w-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ height: `${Math.round(((done + active) / total) * 100)}%` }}
            />
          )}
          {/* Done layer on top */}
          <div
            className="absolute bottom-0 left-0 w-full rounded-full bg-green-500 transition-all duration-500"
            style={{ height: `${pct}%` }}
          />
        </div>

        {/* Stats */}
        <div className="flex flex-col items-center gap-1 text-center">
          {done > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-400">{done}</p>
              <p className="text-[10px] text-zinc-500">done</p>
            </div>
          )}
          {active > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-400">{active}</p>
              <p className="text-[10px] text-zinc-500">active</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-zinc-400">{total}</p>
            <p className="text-[10px] text-zinc-500">total</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1" title="Click: unlock -> active -> done -> reset">
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            <span className="text-[9px] text-zinc-600">tap</span>
          </div>
        </div>
      </div>
    </div>
  )
}
