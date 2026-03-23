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
