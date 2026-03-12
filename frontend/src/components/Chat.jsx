import { useChat } from '@ai-sdk/react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
    api: `${import.meta.env.VITE_API_URL}/chat`,
    body: {},
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  return (
    <Card className="flex h-full flex-col">
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Ask me anything about your knowledge base.
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

      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-4">
        <Input
          value={input ?? ''}
          onChange={handleInputChange}
          placeholder="Ask a question..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={isLoading || !(input ?? '').trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  )
}
