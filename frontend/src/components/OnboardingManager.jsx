import { useState, useEffect } from 'react'
import { Plus, Trash2, ArrowLeft, ChevronDown, ChevronUp, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const API = import.meta.env.VITE_API_URL

export default function OnboardingManager({ onBack }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    required_skills: '',
    assignee_name: '',
    created_by: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/onboarding/tasks`)
      const data = await res.json()
      setTasks(data)
    } catch {
      setError('Failed to load tasks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        required_skills: form.required_skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        assignee_name: form.assignee_name.trim() || null,
        created_by: form.created_by.trim() || null,
      }
      const res = await fetch(`${API}/onboarding/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to create task')
      setForm({
        title: '',
        description: '',
        required_skills: '',
        assignee_name: '',
        created_by: '',
      })
      setShowForm(false)
      await fetchTasks()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await fetch(`${API}/onboarding/tasks/${id}`, { method: 'DELETE' })
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } catch {
      setError('Failed to delete task.')
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">Manager Dashboard</h2>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? (
            <>
              <ChevronUp className="mr-1 h-4 w-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="mr-1 h-4 w-4" /> New Task
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Onboarding Task</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Task Title *</label>
                <Input
                  required
                  placeholder="e.g. Implement payment gateway integration"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Task Description *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe what the employee will be working on, the context, and the expected outcome..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Required Skills{' '}
                  <span className="text-muted-foreground/60">(comma-separated)</span>
                </label>
                <Input
                  placeholder="e.g. REST APIs, Stripe SDK, Python, error handling"
                  value={form.required_skills}
                  onChange={(e) => setForm((f) => ({ ...f, required_skills: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Assignee Name</label>
                  <Input
                    placeholder="e.g. Alice"
                    value={form.assignee_name}
                    onChange={(e) => setForm((f) => ({ ...f, assignee_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Created By</label>
                  <Input
                    placeholder="e.g. Bob (Tech Lead)"
                    value={form.created_by}
                    onChange={(e) => setForm((f) => ({ ...f, created_by: e.target.value }))}
                  />
                </div>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating & generating learning path…' : 'Create Task'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          {loading
            ? 'Loading tasks...'
            : `${tasks.length} onboarding task${tasks.length !== 1 ? 's' : ''}`}
        </h3>
        {!loading && tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No tasks yet. Create one to assign to a team member.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium">{task.title}</p>
                    {task.assignee_name && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Assigned to: {task.assignee_name}
                        {task.created_by ? ` · by ${task.created_by}` : ''}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {task.required_skills?.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                      {task.learning_path?.nodes?.length > 0 && (
                        <Badge
                          variant="outline"
                          className="text-xs text-indigo-400 border-indigo-400/40 gap-1"
                        >
                          <GitBranch className="h-2.5 w-2.5" />
                          {task.learning_path.nodes.length} learning nodes
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
