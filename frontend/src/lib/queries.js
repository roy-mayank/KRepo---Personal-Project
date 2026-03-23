import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, API_URL } from '@/lib/api'

// ── Tasks (onboarding) ──────────────────────────────────────────────────────

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const data = await apiFetch('/onboarding/tasks')
      return Array.isArray(data) ? data : []
    },
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) =>
      apiFetch('/onboarding/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiFetch(`/onboarding/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

// ── Documents ────────────────────────────────────────────────────────────────

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const data = await apiFetch('/documents/')
      return data.documents || []
    },
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiFetch('/documents/upload', { method: 'POST', body: formData })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sourceId) =>
      apiFetch(`/documents/${encodeURIComponent(sourceId)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useGitHubIngest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) =>
      apiFetch('/github/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })
}

// ── Auth / Invites ───────────────────────────────────────────────────────────

export function useInviteUser() {
  return useMutation({
    mutationFn: ({ email, role }) =>
      apiFetch('/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      }),
  })
}
