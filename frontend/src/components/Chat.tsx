import { MessageSquarePlus, Send, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, API_URL } from '@/lib/api'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ConversationSummary {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface ConversationDetail {
  id: string
  title: string
  messages: { id: string; role: string; content: string; created_at: string }[]
}

type Status = 'ready' | 'streaming'

export default function Chat(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<Status>('ready')
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Sidebar: list of conversations
  const { data: conversations = [] } = useQuery<ConversationSummary[]>({
    queryKey: ['conversations'],
    queryFn: () => apiFetch<ConversationSummary[]>('/conversations'),
  })

  // Load a conversation from the sidebar
  const loadConversation = useCallback(async (id: string) => {
    const data = await apiFetch<ConversationDetail>(`/conversations/${id}`)
    setConversationId(id)
    setMessages(
      data.messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    )
  }, [])

  const deleteConversation = useCallback(
    async (id: string) => {
      await apiFetch(`/conversations/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      if (conversationId === id) {
        setConversationId(null)
        setMessages([])
      }
    },
    [conversationId, queryClient],
  )

  const newChat = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setInput('')
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || status !== 'ready') return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '' }

    const updatedMessages = [...messages, userMsg]
    setMessages([...updatedMessages, assistantMsg])
    setInput('')
    setStatus('streaming')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }

      const user = auth.currentUser
      if (user) {
        headers['Authorization'] = `Bearer ${await user.getIdToken()}`
      }
      const slug = localStorage.getItem('krepo_tenant_slug')
      if (slug) {
        headers['X-Tenant-Slug'] = slug
      }

      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          conversation_id: conversationId,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Request failed (${res.status})`)
      }

      // Capture conversation ID from response header (new conversations)
      const newConvoId = res.headers.get('X-Conversation-Id')
      if (newConvoId && !conversationId) {
        setConversationId(newConvoId)
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let accumulated = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          const snapshot = accumulated
          setMessages((prev) => {
            const copy = [...prev]
            copy[copy.length - 1] = { ...copy[copy.length - 1], content: snapshot }
            return copy
          })
        }
      }

      // Refresh sidebar
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            content: `Error: ${(err as Error).message}`,
          }
          return copy
        })
      }
    } finally {
      setStatus('ready')
      abortRef.current = null
    }
  }, [input, status, messages, conversationId, queryClient])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    sendMessage()
  }

  return (
    <div className="flex h-full">
      {/* Conversation sidebar */}
      <div className="flex w-56 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Chats</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={newChat}>
            <MessageSquarePlus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 p-1">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs cursor-pointer ${
                  conversationId === c.id ? 'bg-muted' : 'hover:bg-muted/50'
                }`}
                onClick={() => loadConversation(c.id)}
              >
                <span className="flex-1 truncate">{c.title}</span>
                <button
                  className="hidden shrink-0 text-muted-foreground hover:text-destructive group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteConversation(c.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <Card className="flex flex-1 flex-col rounded-none border-0">
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
                      ? 'bg-primary text-primary-foreground whitespace-pre-wrap'
                      : 'bg-muted text-foreground prose prose-sm prose-invert max-w-none'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}

            {status === 'streaming' && messages[messages.length - 1]?.content === '' && (
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
            ref={inputRef}
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
    </div>
  )
}
