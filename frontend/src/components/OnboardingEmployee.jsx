import { useState, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { ArrowLeft, Send, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import LearningFlow from './LearningFlow'

const API = import.meta.env.VITE_API_URL

// ── Learning flow for a specific task ──────────────────────────────────────
function LearningSession({ task, onBack }) {
  const [concepts, setConcepts] = useState(null)
  const [ratings, setRatings] = useState({})
  const [learningPath, setLearningPath] = useState(null)
  const [started, setStarted] = useState(false)

  const { messages, sendMessage, status } = useChat({
    api: `${API}/chat`,
    body: {
      mode: 'onboarding',
      task_context: task,
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Parse assistant JSON responses
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
      }
    } catch {
      // non-JSON assistant message — ignore
    }
  }, [messages])

  const beginAssessment = () => {
    setStarted(true)
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
      <div className="flex items-center gap-3 border-b p-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium">{task.title}</p>
          {task.assignee_name && (
            <p className="text-xs text-muted-foreground">Assigned to: {task.assignee_name}</p>
          )}
        </div>
      </div>

      {/* Pre-start: show task context */}
      {!started && (
        <div className="p-4 flex flex-col gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-2">Your task</p>
              <p className="text-sm">{task.description}</p>
              {task.required_skills?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {task.required_skills.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">
            The assistant will assess your knowledge across the concepts needed for this task, then
            generate a personalised learning path based on your current level.
          </p>
          <Button onClick={beginAssessment}>
            <BookOpen className="mr-2 h-4 w-4" />
            Begin Assessment
          </Button>
        </div>
      )}

      {/* Concept rating form */}
      {concepts && (
        <form onSubmit={submitRatings} className="border-b p-4 space-y-3">
          <p className="text-sm font-medium">Rate your knowledge (0 = none, 10 = expert)</p>
          {concepts.map((c) => (
            <div key={c.name} className="flex items-center gap-3">
              <label className="flex-1 text-sm">{c.level_question}</label>
              <input
                type="number"
                min={0}
                max={10}
                value={ratings[c.name] ?? ''}
                onChange={(e) => setRatings((r) => ({ ...r, [c.name]: Number(e.target.value) }))}
                className="w-16 rounded border bg-background px-2 py-1 text-sm"
                required
              />
            </div>
          ))}
          <Button type="submit" disabled={Object.keys(ratings).length !== concepts.length}>
            Submit Ratings
          </Button>
        </form>
      )}

      {/* Chat messages */}
      {started && (
        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {/* Show human-friendly text instead of raw JSON */}
                  {msg.role === 'assistant' &&
                    (() => {
                      try {
                        const obj = JSON.parse(msg.content)
                        if (obj.concepts)
                          return (
                            <p className="italic">Knowledge assessment ready — see form above.</p>
                          )
                        if (obj.learning_path)
                          return <p className="italic">Learning path generated — see below.</p>
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
                <div className="rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground italic">
                  Thinking...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Learning path graph */}
      {learningPath && (
        <div className="border-t p-4">
          <p className="mb-2 text-sm font-medium">Your personalised learning path</p>
          <LearningFlow path={learningPath} />
        </div>
      )}
    </div>
  )
}

// ── Task picker ─────────────────────────────────────────────────────────────
export default function OnboardingEmployee({ onBack }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/onboarding/tasks`)
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => setError('Could not load tasks. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  if (selectedTask) {
    return <LearningSession task={selectedTask} onBack={() => setSelectedTask(null)} />
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">My Onboarding Tasks</h2>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading tasks...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && tasks.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No tasks have been assigned yet. Ask your team lead to create one.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {tasks.map((task) => (
          <Card
            key={task.id}
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => setSelectedTask(task)}
          >
            <CardContent className="p-4">
              <p className="font-medium">{task.title}</p>
              {task.created_by && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Assigned by: {task.created_by}
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{task.description}</p>
              {task.required_skills?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {task.required_skills.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
