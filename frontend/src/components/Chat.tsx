import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Send } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TextPart {
  type: 'text'
  text: string
}

interface ReasoningPart {
  type: 'reasoning'
  text: string
}

type MessagePart = TextPart | ReasoningPart | { type: string }

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  parts: MessagePart[]
}

export default function Chat(): React.JSX.Element {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${import.meta.env.VITE_API_URL}/chat`,
    }),
    id: 'tempchatUUID',
  })

  const [input, setInput] = useState<string>('')
  const isLoading = status === 'streaming' || status === 'submitted'

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (input.trim() && status === 'ready') {
      sendMessage({ text: input })
      setInput('')
    }
  }

  return (
    <Card className="flex h-full flex-col rounded-none">
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Ask me anything about your knowledge base.
            </div>
          )}

          {(messages as ChatMessage[]).map((message) => (
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
                {/* Iterate through message.parts instead of using message.content */}
                <div className="whitespace-pre-wrap">
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                      return <span key={index}>{(part as TextPart).text}</span>
                    }
                    if (part.type === 'reasoning') {
                      return (
                        <pre key={index} className="text-xs opacity-70 italic">
                          {(part as ReasoningPart).text}
                        </pre>
                      )
                    }
                    return null
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator using the new status values */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground italic">
                {status === 'submitted' ? 'Connecting...' : 'Thinking...'}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleFormSubmit} className="flex gap-2 border-t p-4">
        <Input
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={status !== 'ready'}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={status !== 'ready' || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  )
}
