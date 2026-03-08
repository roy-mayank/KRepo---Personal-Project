import { useState } from 'react'
import Chat from './components/Chat'
import DocumentUpload from './components/DocumentUpload'
import './App.css'

function App() {
  const [tab, setTab] = useState('chat')

  return (
    <div className="app">
      <nav className="app-nav">
        <button
          className={`nav-tab ${tab === 'chat' ? 'active' : ''}`}
          onClick={() => setTab('chat')}
        >
          Chat
        </button>
        <button
          className={`nav-tab ${tab === 'documents' ? 'active' : ''}`}
          onClick={() => setTab('documents')}
        >
          Documents
        </button>
      </nav>
      <div className="app-content">
        {tab === 'chat' ? <Chat /> : <DocumentUpload />}
      </div>
    </div>
  )
}

export default App
