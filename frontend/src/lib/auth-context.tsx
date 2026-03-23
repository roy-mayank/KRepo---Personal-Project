import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { apiFetch } from '@/lib/api'

interface Tenant {
  id: string
  slug: string
  name: string
}

interface TenantMembership {
  tenant: Tenant
  role: string
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  tenants: TenantMembership[]
  activeTenant: string | null
  selectTenant: (slug: string) => void
  hasOrg: boolean
  tenantsLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  // undefined = loading, null = not authed
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [activeTenant, setActiveTenant] = useState<string | null>(
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

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<TenantMembership[]>({
    queryKey: ['tenants'],
    queryFn: () => apiFetch<TenantMembership[]>('/auth/tenants'),
    enabled: !!user,
    select: (data: TenantMembership[]) => {
      // Auto-select tenant if only one and none selected
      if (data.length === 1 && !activeTenant) {
        const slug = data[0].tenant.slug
        setActiveTenant(slug)
        localStorage.setItem('krepo_tenant_slug', slug)
      }
      return data
    },
  })

  const selectTenant = (slug: string): void => {
    setActiveTenant(slug)
    localStorage.setItem('krepo_tenant_slug', slug)
  }

  const loading = user === undefined || (!!user && tenantsLoading)
  const hasOrg = tenants.length > 0

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        loading,
        tenants,
        activeTenant,
        selectTenant,
        hasOrg,
        tenantsLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
