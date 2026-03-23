import { auth } from '@/lib/firebase'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Wrapper around fetch that auto-injects Firebase auth token
 * and X-Tenant-Slug header from localStorage.
 */
export async function apiFetch(path, options = {}) {
  const headers = { ...options.headers }

  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    headers['Authorization'] = `Bearer ${token}`
  }

  const tenantSlug = localStorage.getItem('krepo_tenant_slug')
  if (tenantSlug) {
    headers['X-Tenant-Slug'] = tenantSlug
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error = new Error(body.detail || `Request failed (${res.status})`)
    error.status = res.status
    error.body = body
    throw error
  }

  if (res.status === 204) return null
  return res.json()
}
