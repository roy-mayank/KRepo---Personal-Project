import { useState, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import LearningFlow from './LearningFlow'

export default function Onboarding() {
  const { messages, input, handleInputChange, handleSubmit, status, sendMessage } = useChat({
    api: `${import.meta.env.VITE_API_URL}/chat`,
    body: { mode: 'onboarding' },
  })

  const [concepts, setConcepts] = useState(null)
  const [ratings, setRatings] = useState({})
  const [learningPath, setLearningPath] = useState(null)

  const isLoading = status === 'streaming' || status === 'submitted'

  // watch for assistant JSON responses
  useEffect(() => {
    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.role !== 'assistant') return
    try {
      const obj = JSON.parse(last.content)
      if (obj.concepts && !obj.learning_path) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setConcepts(obj.concepts)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRatings({})
      } else if (obj.learning_path) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLearningPath(obj.learning_path)
      }
    } catch {
      // ignore non-JSON content
    }
  }, [messages])

  const handleRatingChange = (name, value) => {
    setRatings((r) => ({ ...r, [name]: Number(value) }))
  }

  const submitRatings = (e) => {
    e.preventDefault()
    sendMessage({ role: 'user', content: JSON.stringify({ ratings }) })
    setConcepts(null)
    setRatings({})
  }

  return (
    <Card className="flex h-full flex-col">
      {/* brief explanation for users */}
      <div className="p-2 text-sm text-muted-foreground">
        <p>
          This page is for onboarding flows. A senior engineer or project manager can type a task
          description as the first message. The assistant will respond with a set of concepts and
          ask you to rate your knowledge (0 - 10) for each. After you reply with the ratings, it
          will return a suggested learning path rendered as a graph. Fill in the form below when it
          appears.
        </p>
      </div>

      {/* rating form */}
      {concepts && (
        <form onSubmit={submitRatings} className="p-4 space-y-2 border-b">
          {concepts.map((c) => (
            <div key={c.name} className="flex items-center gap-2">
              <label className="flex-1 text-sm">{c.level_question}</label>
              <input
                type="number"
                min={0}
                max={10}
                value={ratings[c.name] ?? ''}
                onChange={(e) => handleRatingChange(c.name, e.target.value)}
                className="w-16 rounded border px-2 py-1"
                required
              />
            </div>
          ))}
          <Button type="submit" disabled={Object.keys(ratings).length !== concepts.length}>
            Submit ratings
          </Button>
        </form>
      )}

      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-3">
          {messages.length === 0 && !concepts && (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Describe a task to begin onboarding.
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
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

      {learningPath && (
        <div className="p-4 border-t">
          <LearningFlow path={learningPath} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-4">
        <Input
          value={input ?? ''}
          onChange={handleInputChange}
          placeholder="Enter your response or ratings..."
          disabled={isLoading || concepts}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={isLoading || !(input ?? '').trim() || concepts}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  )
}
