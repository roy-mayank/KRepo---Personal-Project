import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL

export default function DocumentUpload() {
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [message, setMessage] = useState(null)

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/documents/`)
      const data = await res.json()
      setDocuments(data.documents || [])
    } catch {
      /* server may not be running */
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setMessage(null)

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`${API_URL}/documents/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json()
          setMessage({ type: 'error', text: err.detail || 'Upload failed' })
          continue
        }

        const data = await res.json()
        setMessage({
          type: 'success',
          text: `Uploaded "${data.filename}" — ${data.chunks_ingested} chunks ingested`,
        })
      }
      await fetchDocuments()
    } catch {
      setMessage({ type: 'error', text: 'Upload failed. Is the backend running?' })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (sourceId) => {
    try {
      await fetch(`${API_URL}/documents/${encodeURIComponent(sourceId)}`, {
        method: 'DELETE',
      })
      await fetchDocuments()
    } catch {
      setMessage({ type: 'error', text: 'Delete failed' })
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    handleUpload(e.dataTransfer.files)
  }

  return (
    <div className="documents-container">
      <div className="documents-header">
        <h2>Documents</h2>
      </div>

      <div
        className={`upload-zone ${dragActive ? 'active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input').click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,.txt,.md,.csv,.json"
          style={{ display: 'none' }}
          onChange={(e) => handleUpload(e.target.files)}
        />
        {uploading ? (
          <p>Uploading...</p>
        ) : (
          <p>Drop files here or click to upload<br />
            <span className="upload-hint">PDF, TXT, MD, CSV, JSON</span>
          </p>
        )}
      </div>

      {message && (
        <div className={`upload-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="documents-list">
        <h3>Ingested Documents</h3>
        {documents.length === 0 ? (
          <p className="documents-empty">No documents ingested yet.</p>
        ) : (
          <ul>
            {documents.map((doc) => (
              <li key={doc.source_id} className="document-item">
                <div className="document-info">
                  <span className="document-title">{doc.title}</span>
                  <span className="document-source">{doc.source}</span>
                </div>
                <button
                  className="document-delete"
                  onClick={(e) => { e.stopPropagation(); handleDelete(doc.source_id) }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
