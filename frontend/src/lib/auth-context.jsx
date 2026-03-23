import { createContext, useContext, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { apiFetch } from '@/lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState(undefined) // undefined = loading, null = not authed
  const [activeTenant, setActiveTenant] = useState(
    () => localStorage.getItem('krepo_tenant_slug') || null,
  )

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      if (!firebaseUser) {
        queryClient.removeQueries({ queryKey: ['tenants'] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['tenants'] })
      }
    })
  }, [queryClient])

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => apiFetch('/auth/tenants'),
    enabled: !!user,
    select: (data) => {
      // Auto-select tenant if only one and none selected
      if (data.length === 1 && !activeTenant) {
        const slug = data[0].tenant.slug
        setActiveTenant(slug)
        localStorage.setItem('krepo_tenant_slug', slug)
      }
      return data
    },
  })

  const selectTenant = (slug) => {
    setActiveTenant(slug)
    localStorage.setItem('krepo_tenant_slug', slug)
  }

  const loading = user === undefined || (!!user && tenantsLoading)
  const hasOrg = tenants.length > 0

  return (
    <AuthContext.Provider
      value={{ user, loading, tenants, activeTenant, selectTenant, hasOrg, tenantsLoading }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
