import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, Trash2, Github, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { useDocuments, useUploadDocument, useDeleteDocument, useGitHubIngest } from '@/lib/queries'
import { API_URL } from '@/lib/api'

export default function DocumentUpload() {
  const { data: documents = [], isLoading } = useDocuments()
  const uploadDoc = useUploadDocument()
  const deleteDoc = useDeleteDocument()
  const githubIngest = useGitHubIngest()

  const [dragActive, setDragActive] = useState(false)
  const [message, setMessage] = useState(null)
  const fileInputRef = useRef(null)

  // GitHub state
  const [ghToken, setGhToken] = useState('')
  const [ghRepos, setGhRepos] = useState('')
  const [ghSyncing, setGhSyncing] = useState(false)
  const [ghMessage, setGhMessage] = useState(null)
  const pollRef = useRef(null)

  // cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return
    setMessage(null)

    try {
      for (const file of files) {
        const data = await uploadDoc.mutateAsync(file)
        setMessage({
          type: 'success',
          text: `Uploaded "${data.filename}" — ${data.chunks_ingested} chunks ingested`,
        })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Upload failed' })
    }
  }

  const handleDelete = async (sourceId) => {
    try {
      await deleteDoc.mutateAsync(sourceId)
    } catch {
      setMessage({ type: 'error', text: 'Delete failed' })
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    handleUpload(e.dataTransfer.files)
  }

  const handleGitHubSync = async () => {
    const repos = ghRepos
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
    if (repos.length === 0) {
      setGhMessage({ type: 'error', text: 'Enter at least one repository (owner/repo)' })
      return
    }

    if (pollRef.current) clearInterval(pollRef.current)
    setGhSyncing(true)
    setGhMessage({ type: 'info', text: 'Starting ingestion…' })

    try {
      const body = { repos }
      if (ghToken.trim()) body.token = ghToken.trim()

      await githubIngest.mutateAsync(body)

      const statusKey = repos.join(',')
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_URL}/github/ingest/status`)
          const statusData = await statusRes.json()
          const status = statusData.status?.[statusKey]
          if (!status) return

          if (status.startsWith('completed')) {
            clearInterval(pollRef.current)
            setGhSyncing(false)
            setGhMessage({ type: 'success', text: `Synced — ${status.replace('completed: ', '')}` })
          } else if (status.startsWith('error')) {
            clearInterval(pollRef.current)
            setGhSyncing(false)
            setGhMessage({ type: 'error', text: status.replace('error: ', '') })
          } else {
            setGhMessage({ type: 'info', text: `Syncing… (${status})` })
          }
        } catch {
          /* ignore transient poll errors */
        }
      }, 2000)
    } catch (err) {
      setGhMessage({ type: 'error', text: err.message || 'Failed to connect' })
      setGhSyncing(false)
    }
  }

  const uploading = uploadDoc.isPending

  return (
    <Card className="flex h-full flex-col p-4 gap-4 overflow-y-auto">
      <h2 className="text-lg font-semibold">Documents</h2>

      {/* File upload */}
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
          <p className="text-sm text-muted-foreground">Uploading…</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Drop files here or click to upload</p>
            <p className="text-xs text-muted-foreground/60">PDF, TXT, MD, CSV, JSON</p>
          </>
        )}
      </div>

      {message && <StatusBanner message={message} />}

      {/* GitHub connect */}
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2">
          <Github className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Connect GitHub Repositories</h3>
        </div>

        <div className="flex flex-col gap-2">
          <Input
            type="password"
            placeholder="Personal access token (optional if set in .env)"
            value={ghToken}
            onChange={(e) => setGhToken(e.target.value)}
            className="text-sm h-8"
          />
          <Input
            type="text"
            placeholder="owner/repo, owner/repo2, …"
            value={ghRepos}
            onChange={(e) => setGhRepos(e.target.value)}
            className="text-sm h-8"
          />
        </div>

        <Button
          size="sm"
          onClick={handleGitHubSync}
          disabled={ghSyncing}
          className="self-start gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${ghSyncing ? 'animate-spin' : ''}`} />
          {ghSyncing ? 'Syncing…' : 'Sync repositories'}
        </Button>

        {ghMessage && <StatusBanner message={ghMessage} />}
      </div>

      {/* Document list */}
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <h3 className="text-sm font-medium text-muted-foreground">
          {isLoading ? 'Loading…' : 'Ingested Documents'}
        </h3>
        <ScrollArea className="flex-1">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 py-4 text-center">
              No documents ingested yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {documents.map((doc) => {
                const isGitHub = doc.source?.startsWith('github:')
                return (
                  <div
                    key={doc.source_id}
                    className="flex items-center justify-between rounded-lg bg-muted px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      {isGitHub ? (
                        <Github className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
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
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </Card>
  )
}

function StatusBanner({ message }) {
  const colours = {
    success: 'bg-green-500/10 text-green-500',
    error: 'bg-destructive/10 text-destructive',
    info: 'bg-blue-500/10 text-blue-400',
  }
  return (
    <div className={`rounded-lg px-4 py-2.5 text-sm ${colours[message.type] ?? colours.info}`}>
      {message.text}
    </div>
  )
}
