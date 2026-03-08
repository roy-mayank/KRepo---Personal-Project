import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

const API_URL = import.meta.env.VITE_API_URL

export default function DocumentUpload() {
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [message, setMessage] = useState(null)
  const fileInputRef = useRef(null)

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
    <Card className="flex h-full flex-col p-4 gap-4">
      <h2 className="text-lg font-semibold">Documents</h2>

      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.csv,.json"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Upload className="h-8 w-8 text-muted-foreground" />
        {uploading ? (
          <p className="text-sm text-muted-foreground">Uploading...</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Drop files here or click to upload</p>
            <p className="text-xs text-muted-foreground/60">PDF, TXT, MD, CSV, JSON</p>
          </>
        )}
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-2.5 text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-500'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Ingested Documents</h3>
        <ScrollArea className="flex-1">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 py-4 text-center">
              No documents ingested yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {documents.map((doc) => (
                <div
                  key={doc.source_id}
                  className="flex items-center justify-between rounded-lg bg-muted px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.title}</p>
                      <p className="text-xs text-muted-foreground uppercase">{doc.source}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(doc.source_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </Card>
  )
}
