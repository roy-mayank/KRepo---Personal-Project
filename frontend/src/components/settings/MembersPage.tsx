import { useState } from 'react'
import { Check, Copy, Mail, Trash2, UserPlus, Users } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface UserInfo {
  id: string
  email: string
  role: 'admin' | 'member' | 'user'
  tenant_id: string
  is_active: boolean
}

interface InviteResponse {
  invite_token: string
  email: string
  role: string
  expires_in_hours: number
}

export default function MembersPage(): React.JSX.Element {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [copied, setCopied] = useState<string | null>(null)
  const [lastInvite, setLastInvite] = useState<InviteResponse | null>(null)

  const { data: me } = useQuery<UserInfo>({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<UserInfo>('/auth/me'),
  })

  const { data: members = [], isLoading } = useQuery<UserInfo[]>({
    queryKey: ['auth', 'users'],
    queryFn: () => apiFetch<UserInfo[]>('/auth/users'),
    enabled: me?.role === 'admin',
  })

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      apiFetch<InviteResponse>('/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      setLastInvite(data)
      setInviteEmail('')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => apiFetch(`/auth/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'users'] })
    },
  })

  const copyToken = async (token: string) => {
    await navigator.clipboard.writeText(token)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const isAdmin = me?.role === 'admin'

  return (
    <div className="flex flex-col gap-5">
      {/* Invite form (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base gap-2 flex items-center">
              <UserPlus className="h-4 w-4 text-blue-400" />
              Invite team member
            </CardTitle>
            <CardDescription>Send an invitation to join your organisation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setInviteEmail(e.target.value)
                }
                className="flex-1"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button
              size="sm"
              className="w-full gap-1.5"
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
            >
              <Mail className="h-3.5 w-3.5" />
              {inviteMutation.isPending ? 'Sending...' : 'Send invite'}
            </Button>

            {inviteMutation.isError && (
              <p className="text-xs text-destructive">{(inviteMutation.error as Error).message}</p>
            )}

            {lastInvite && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-2">
                <p className="text-xs text-green-400">
                  Invite sent to {lastInvite.email} (expires in {lastInvite.expires_in_hours}h)
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-[10px] font-mono text-muted-foreground">
                    {lastInvite.invite_token}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => copyToken(lastInvite.invite_token)}
                  >
                    {copied === lastInvite.invite_token ? (
                      <Check className="h-3 w-3 text-green-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base gap-2 flex items-center">
            <Users className="h-4 w-4 text-muted-foreground" />
            Members
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? `${members.length} member${members.length !== 1 ? 's' : ''} in your organisation`
              : 'Team members'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">
              Only admins can view and manage team members.
            </p>
          )}

          {isAdmin && isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}

          {isAdmin && !isLoading && (
            <div className="divide-y divide-border/50">
              {members.map((member) => {
                const isMe = member.email === user?.email
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {member.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {member.email}
                        {isMe && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant={member.role === 'admin' ? 'default' : 'secondary'}
                      className="text-[10px]"
                    >
                      {member.role}
                    </Badge>
                    {isAdmin && !isMe && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeMutation.mutate(member.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
