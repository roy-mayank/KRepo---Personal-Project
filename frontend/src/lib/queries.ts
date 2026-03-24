import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { ApiFetchError } from '@/lib/api'

// ── Domain types ────────────────────────────────────────────────────────────

export interface LearningPathNode {
  id: string
  title: string
  description: string
  prerequisites: string[]
  xp: number
}

export interface LearningPath {
  nodes: LearningPathNode[]
}

export interface Task {
  id: string
  title: string
  description: string
  completed: boolean
  required_skills?: string[]
  assignee_name?: string | null
  created_by?: string | null
  learning_path?: LearningPath | null
}

export interface CreateTaskPayload {
  title: string
  description: string
  required_skills?: string[]
  assignee_name?: string | null
  created_by?: string | null
}

export interface Document {
  source_id: string
  filename: string
  status: string
  [key: string]: unknown
}

interface DocumentsResponse {
  documents: Document[]
}

export interface GitHubIngestPayload {
  repo_url: string
  include_filetrees?: boolean
  include_docstrings?: boolean
}

export interface InviteUserPayload {
  email: string
  role: string
}

interface InviteResponse {
  message: string
  [key: string]: unknown
}

// ── Tasks (onboarding) ─────────────────────────────────────────────────────

export function useTasks(): UseQueryResult<Task[], ApiFetchError> {
  return useQuery<Task[], ApiFetchError>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const data = await apiFetch<Task[]>('/onboarding/tasks')
      return Array.isArray(data) ? data : []
    },
  })
}

export function useCreateTask(): UseMutationResult<Task, ApiFetchError, CreateTaskPayload> {
  const queryClient = useQueryClient()
  return useMutation<Task, ApiFetchError, CreateTaskPayload>({
    mutationFn: (payload) =>
      apiFetch<Task>('/onboarding/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useDeleteTask(): UseMutationResult<null, ApiFetchError, string> {
  const queryClient = useQueryClient()
  return useMutation<null, ApiFetchError, string>({
    mutationFn: (id) => apiFetch<null>(`/onboarding/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

// ── Documents ───────────────────────────────────────────────────────────────

export function useDocuments(): UseQueryResult<Document[], ApiFetchError> {
  return useQuery<Document[], ApiFetchError>({
    queryKey: ['documents'],
    queryFn: async () => {
      const data = await apiFetch<DocumentsResponse>('/documents/')
      return data.documents || []
    },
  })
}

export function useUploadDocument(): UseMutationResult<Document, ApiFetchError, File> {
  const queryClient = useQueryClient()
  return useMutation<Document, ApiFetchError, File>({
    mutationFn: (file) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiFetch<Document>('/documents/upload', {
        method: 'POST',
        body: formData,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useDeleteDocument(): UseMutationResult<null, ApiFetchError, string> {
  const queryClient = useQueryClient()
  return useMutation<null, ApiFetchError, string>({
    mutationFn: (sourceId) =>
      apiFetch<null>(`/documents/${encodeURIComponent(sourceId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useGitHubIngest(): UseMutationResult<unknown, ApiFetchError, GitHubIngestPayload> {
  const queryClient = useQueryClient()
  return useMutation<unknown, ApiFetchError, GitHubIngestPayload>({
    mutationFn: (body) =>
      apiFetch('/github/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })
}

// ── Integrations ───────────────────────────────────────────────────────────

export interface IntegrationConnection {
  provider: string
  workspace_name: string | null
  workspace_id: string | null
  status: string
  connected_at: string
  last_sync_at: string | null
}

interface ConnectResponse {
  authorize_url: string
}

interface SyncResponse {
  message: string
}

interface SyncStatusResponse {
  status: Record<string, string>
}

export function useIntegrationConnections(): UseQueryResult<
  IntegrationConnection[],
  ApiFetchError
> {
  return useQuery<IntegrationConnection[], ApiFetchError>({
    queryKey: ['integrations', 'connections'],
    queryFn: () => apiFetch<IntegrationConnection[]>('/integrations/connections'),
  })
}

export function useConnectIntegration(): UseMutationResult<ConnectResponse, ApiFetchError, string> {
  return useMutation<ConnectResponse, ApiFetchError, string>({
    mutationFn: (provider) => apiFetch<ConnectResponse>(`/integrations/${provider}/connect`),
  })
}

export function useSyncIntegration(): UseMutationResult<SyncResponse, ApiFetchError, string> {
  const queryClient = useQueryClient()
  return useMutation<SyncResponse, ApiFetchError, string>({
    mutationFn: (provider) =>
      apiFetch<SyncResponse>(`/integrations/${provider}/sync`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations', 'connections'] }),
  })
}

export function useDisconnectIntegration(): UseMutationResult<SyncResponse, ApiFetchError, string> {
  const queryClient = useQueryClient()
  return useMutation<SyncResponse, ApiFetchError, string>({
    mutationFn: (provider) =>
      apiFetch<SyncResponse>(`/integrations/${provider}/disconnect`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations', 'connections'] }),
  })
}

export function useSyncStatus(): UseQueryResult<SyncStatusResponse, ApiFetchError> {
  return useQuery<SyncStatusResponse, ApiFetchError>({
    queryKey: ['integrations', 'sync-status'],
    queryFn: () => apiFetch<SyncStatusResponse>('/integrations/sync/status'),
    refetchInterval: 3000,
  })
}

// ── Auth / Invites ──────────────────────────────────────────────────────────

export function useInviteUser(): UseMutationResult<
  InviteResponse,
  ApiFetchError,
  InviteUserPayload
> {
  return useMutation<InviteResponse, ApiFetchError, InviteUserPayload>({
    mutationFn: ({ email, role }) =>
      apiFetch<InviteResponse>('/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      }),
  })
}
