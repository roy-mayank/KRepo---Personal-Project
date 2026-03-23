import { useState, type FormEvent } from 'react'
import { Plus, Trash2, ChevronUp, GitBranch, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTasks, useCreateTask, useDeleteTask } from '@/lib/queries'

interface TaskFormState {
  title: string
  description: string
  required_skills: string
  assignee_name: string
  created_by: string
}

const EMPTY_FORM: TaskFormState = {
  title: '',
  description: '',
  required_skills: '',
  assignee_name: '',
  created_by: '',
}

export default function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks()
  const createTask = useCreateTask()
  const deleteTask = useDeleteTask()

  const [showForm, setShowForm] = useState(false)
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM)

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setIsOnboarding(false)
    createTask.reset()
  }

  const toggleForm = () => {
    if (showForm) resetForm()
    setShowForm((v) => !v)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      required_skills: form.required_skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      assignee_name: isOnboarding ? form.assignee_name.trim() || null : null,
      created_by: isOnboarding ? form.created_by.trim() || null : null,
    }
    await createTask.mutateAsync(payload)
    resetForm()
    setShowForm(false)
  }

  const error = createTask.error?.message || deleteTask.error?.message

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1">
            <h1
              style={{ fontFamily: 'Roboto, sans-serif' }}
              className="text-2xl font-bold text-white"
            >
              Tasks
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Manage and assign tasks for your team.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-700 text-gray-300 hover:text-white hover:border-gray-600"
            onClick={toggleForm}
          >
            {showForm ? (
              <>
                <ChevronUp className="mr-1.5 h-4 w-4" /> Cancel
              </>
            ) : (
              <>
                <Plus className="mr-1.5 h-4 w-4" /> New Task
              </>
            )}
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <Card className="bg-[#0f0f0f] border-gray-800 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white">Create Task</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Task Title *</label>
                  <Input
                    required
                    placeholder="e.g. Implement payment gateway integration"
                    value={form.title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-gray-500">Description *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe what needs to be done, the context, and expected outcome..."
                    value={form.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-gray-500">
                    Required Skills <span className="text-gray-600">(comma-separated)</span>
                  </label>
                  <Input
                    placeholder="e.g. REST APIs, Python, error handling"
                    value={form.required_skills}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setForm((f) => ({ ...f, required_skills: e.target.value }))
                    }
                  />
                </div>

                {/* Onboarding toggle */}
                <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/30 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setIsOnboarding((v) => !v)}
                    className="flex items-center gap-2 text-sm"
                  >
                    {isOnboarding ? (
                      <ToggleRight className="h-5 w-5 text-blue-400" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-gray-600" />
                    )}
                    <span className={isOnboarding ? 'text-blue-400 font-medium' : 'text-gray-400'}>
                      Onboarding Task
                    </span>
                  </button>
                  {isOnboarding && (
                    <Badge className="text-xs bg-blue-600/15 text-blue-400 border border-blue-500/25">
                      Generates learning path
                    </Badge>
                  )}
                </div>

                {/* Assignee + Creator -- only when onboarding is on */}
                {isOnboarding && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">Assigned To</label>
                      <Input
                        placeholder="e.g. Alice"
                        value={form.assignee_name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setForm((f) => ({ ...f, assignee_name: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">Created By</label>
                      <Input
                        placeholder="e.g. Bob (Tech Lead)"
                        value={form.created_by}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setForm((f) => ({ ...f, created_by: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                )}

                {error && <p className="text-xs text-red-400">{error}</p>}

                <Button
                  type="submit"
                  disabled={createTask.isPending}
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {createTask.isPending ? 'Creating & generating learning path...' : 'Create Task'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Task list */}
        <div>
          <p className="text-sm text-gray-500 mb-3">
            {isLoading ? 'Loading...' : `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
          </p>

          {!isLoading && tasks.length === 0 && (
            <div className="text-center py-16 text-gray-700 border border-dashed border-gray-800 rounded-xl">
              <p className="text-sm">No tasks yet.</p>
              <p className="text-xs mt-1 text-gray-800">Create one to get started.</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {tasks.map((task) => (
              <Card
                key={task.id}
                className="bg-[#0f0f0f] border-gray-800 hover:border-gray-700 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white">{task.title}</p>
                      {task.assignee_name && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          Assigned to: {task.assignee_name}
                          {task.created_by ? ` · by ${task.created_by}` : ''}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-gray-400">{task.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.required_skills?.map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                        {(task.learning_path?.nodes?.length ?? 0) > 0 && (
                          <Badge
                            variant="outline"
                            className="text-xs text-blue-400 border-blue-500/30 gap-1"
                          >
                            <GitBranch className="h-2.5 w-2.5" />
                            {task.learning_path!.nodes.length} learning nodes
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-gray-700 hover:text-red-400"
                      onClick={() => deleteTask.mutate(task.id)}
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
    </div>
  )
}
