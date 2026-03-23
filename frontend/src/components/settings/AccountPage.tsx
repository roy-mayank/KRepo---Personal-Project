import { Crown, LogOut, Mail, Shield } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { signOut } from 'firebase/auth'
import { useNavigate } from '@tanstack/react-router'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface UserInfo {
  id: string
  email: string
  role: 'admin' | 'member' | 'user'
  tenant_id: string
  is_active: boolean
}

interface TenantInfo {
  id: string
  name: string
  slug: string
}

export default function AccountPage(): React.JSX.Element {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: me } = useQuery<UserInfo>({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<UserInfo>('/auth/me'),
  })

  const { data: tenant } = useQuery<TenantInfo>({
    queryKey: ['auth', 'tenant'],
    queryFn: () => apiFetch<TenantInfo>('/auth/tenant'),
  })

  const handleSignOut = async () => {
    await signOut(auth)
    localStorage.removeItem('krepo_tenant_slug')
    navigate({ to: '/login' })
  }

  const RoleIcon = me?.role === 'admin' ? Crown : Shield

  return (
    <div className="flex flex-col gap-5">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="h-14 w-14 rounded-full ring-2 ring-border"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 ring-2 ring-border">
                  <span className="text-lg font-semibold text-blue-400">
                    {(user?.email?.[0] ?? '?').toUpperCase()}
                  </span>
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-green-500 ring-2 ring-card p-[3px]" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-medium text-sm truncate">
                {user?.displayName || user?.email || 'Unknown'}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
              {me && (
                <Badge variant="secondary" className="mt-1 gap-1">
                  <RoleIcon className="h-2.5 w-2.5" />
                  {me.role}
                </Badge>
              )}
            </div>
          </div>

          {/* Auth provider */}
          <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">
              Signed in via
            </p>
            <p className="text-xs text-muted-foreground">
              {user?.providerData?.[0]?.providerId === 'google.com'
                ? 'Google'
                : user?.providerData?.[0]?.providerId === 'github.com'
                  ? 'GitHub'
                  : 'Email & Password'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Organisation */}
      {tenant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organisation</CardTitle>
            <CardDescription>Current workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{tenant.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">/{tenant.slug}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sign out */}
      <Button
        variant="outline"
        className="w-full gap-2 text-destructive hover:text-destructive"
        onClick={handleSignOut}
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </Button>
    </div>
  )
}
