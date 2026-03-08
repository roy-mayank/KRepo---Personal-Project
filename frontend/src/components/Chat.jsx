import { useChat } from '@ai-sdk/react'

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: 'http://localhost:8000/chat',
  })

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>KRepo Assistant</h2>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            Ask me anything about your knowledge base.
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.role}`}>
            <span className="chat-role">{message.role === 'user' ? 'You' : 'KRepo'}</span>
            <p>{message.content}</p>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">
            <span className="chat-role">KRepo</span>
            <p className="chat-typing">Thinking...</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask a question..."
          className="chat-input"
          disabled={isLoading}
        />
        <button type="submit" className="chat-submit" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
