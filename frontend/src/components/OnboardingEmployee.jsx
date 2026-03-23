import { useState, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { ArrowLeft, Send, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import SkillTree from './SkillTree'

const API = import.meta.env.VITE_API_URL

// ── Learning session ─────────────────────────────────────────────────────────
function LearningSession({ task, onBack }) {
  // Use pre-generated path if available; chat assessment can replace it
  const [learningPath, setLearningPath] = useState(task.learning_path || null)
  const [concepts, setConcepts] = useState(null)
  const [ratings, setRatings] = useState({})
  const [assessing, setAssessing] = useState(!task.learning_path) // skip if path exists
  const [chatOpen, setChatOpen] = useState(!task.learning_path) // show chat if no path

  const { messages, sendMessage, status } = useChat({
    api: `${API}/chat`,
    body: { mode: 'onboarding', task_context: task },
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Parse assistant JSON — update path or concepts when received
  useEffect(() => {
    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.role !== 'assistant') return
    try {
      const obj = JSON.parse(last.content)
      if (obj.concepts) {
        setConcepts(obj.concepts)
        setRatings({})
      }
      if (obj.learning_path?.nodes?.length > 0) {
        setLearningPath(obj.learning_path)
        setAssessing(false)
        setConcepts(null)
      }
    } catch {
      /* non-JSON message — fine */
    }
  }, [messages])

  const beginAssessment = () => {
    setAssessing(true)
    sendMessage({
      role: 'user',
      content: `I am ready to begin my assessment for the task: "${task.title}". Please assess my knowledge.`,
    })
  }

  const submitRatings = (e) => {
    e.preventDefault()
    sendMessage({ role: 'user', content: JSON.stringify({ ratings }) })
    setConcepts(null)
    setRatings({})
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium text-sm">{task.title}</p>
          {task.assignee_name && (
            <p className="text-xs text-muted-foreground">Assigned to: {task.assignee_name}</p>
          )}
        </div>
        {task.required_skills?.length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1 max-w-50">
            {task.required_skills.slice(0, 3).map((s) => (
              <Badge key={s} variant="secondary" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* ── Skill tree (primary view) ── */}
      {learningPath && (
        <div className="flex-1 min-h-0 overflow-hidden p-3">
          <SkillTree path={learningPath} taskId={task.id} />
        </div>
      )}

      {/* ── Chat panel (collapsible at the bottom) ── */}
      <div className="shrink-0 border-t">
        <button
          className="flex w-full items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setChatOpen((v) => !v)}
        >
          <span>{learningPath ? 'Personalise path with AI assessment' : 'Start assessment'}</span>
          {chatOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>

        {chatOpen && (
          <div className="flex flex-col border-t" style={{ height: '280px' }}>
            {/* Task context (shown before assessment starts) */}
            {messages.length === 0 && (
              <div className="p-3 flex flex-col gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground mb-1">Task</p>
                    <p className="text-sm">{task.description}</p>
                  </CardContent>
                </Card>
                <Button size="sm" onClick={beginAssessment}>
                  <BookOpen className="mr-2 h-3.5 w-3.5" />
                  Begin knowledge assessment
                </Button>
              </div>
            )}

            {/* Concept rating form */}
            {concepts && (
              <form onSubmit={submitRatings} className="px-3 py-2 border-b space-y-2">
                <p className="text-xs font-medium">Rate your knowledge (0 = none, 10 = expert)</p>
                {concepts.map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <label className="flex-1 text-xs">{c.level_question}</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={ratings[c.name] ?? ''}
                      onChange={(e) =>
                        setRatings((r) => ({ ...r, [c.name]: Number(e.target.value) }))
                      }
                      className="w-14 rounded border bg-background px-2 py-1 text-xs"
                      required
                    />
                  </div>
                ))}
                <Button
                  type="submit"
                  size="sm"
                  disabled={Object.keys(ratings).length !== concepts.length}
                >
                  Submit ratings
                </Button>
              </form>
            )}

            {/* Chat messages */}
            <ScrollArea className="flex-1 px-3 py-2">
              <div className="flex flex-col gap-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {msg.role === 'assistant' &&
                        (() => {
                          try {
                            const obj = JSON.parse(msg.content)
                            if (obj.concepts)
                              return (
                                <p className="italic">
                                  Knowledge assessment ready — see form above.
                                </p>
                              )
                            if (obj.learning_path)
                              return (
                                <p className="italic">
                                  Personalised path generated — see skill tree above.
                                </p>
                              )
                          } catch {
                            /* fall through */
                          }
                          return <p className="whitespace-pre-wrap">{msg.content}</p>
                        })()}
                      {msg.role === 'user' && (
                        <p className="whitespace-pre-wrap">
                          {(() => {
                            try {
                              const obj = JSON.parse(msg.content)
                              if (obj.ratings)
                                return `Submitted ratings for ${Object.keys(obj.ratings).length} concept(s).`
                            } catch {
                              /* fall through */
                            }
                            return msg.content
                          })()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground italic">
                      Thinking…
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Task picker ──────────────────────────────────────────────────────────────
export default function OnboardingEmployee({ onBack }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/onboarding/tasks`)
      .then((r) => r.json())
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load tasks. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  if (selectedTask) {
    return <LearningSession task={selectedTask} onBack={() => setSelectedTask(null)} />
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h2 className="text-lg font-semibold">My Onboarding Tasks</h2>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading tasks…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && tasks.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No tasks have been assigned yet. Ask your team lead to create one.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {tasks.map((task) => {
          const nodeCount = task.learning_path?.nodes?.length ?? 0
          return (
            <Card
              key={task.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => setSelectedTask(task)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{task.title}</p>
                    {task.created_by && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Assigned by: {task.created_by}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {task.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {task.required_skills?.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                      {nodeCount > 0 && (
                        <Badge
                          variant="outline"
                          className="text-xs text-indigo-400 border-indigo-400/40"
                        >
                          {nodeCount} skill nodes
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
