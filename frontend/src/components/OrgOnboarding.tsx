import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { signOut } from 'firebase/auth'
import { Building2, Users, ArrowRight, Plus, X, Send } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Types ────────────────────────────────────────────────────────────────────

interface RegisterResponse {
  tenant_slug: string
}

interface InviteResponse {
  invite_token?: string
}

interface InviteRow {
  email: string
  role: string
}

interface InviteResult {
  email: string
  ok: boolean
  message: string
}

interface StepIndicatorProps {
  step: number
}

interface CreateOrgStepProps {
  onComplete: (slug: string) => void
}

interface InviteTeamStepProps {
  tenantSlug: string
  onComplete: () => void
}

// ── Components ───────────────────────────────────────────────────────────────

function StepIndicator({ step }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
          step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500'
        }`}
      >
        1
      </div>
      <div className={`flex-1 h-px ${step >= 2 ? 'bg-blue-600' : 'bg-gray-800'}`} />
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
          step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500'
        }`}
      >
        2
      </div>
    </div>
  )
}

function CreateOrgStep({ onComplete }: CreateOrgStepProps) {
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!orgName.trim()) return

    setError('')
    setLoading(true)
    try {
      const token = await auth.currentUser!.getIdToken()
      const data = await apiFetch<RegisterResponse>('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_name: orgName.trim(),
          firebase_id_token: token,
        }),
      })
      onComplete(data.tenant_slug)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create organisation'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-center mb-2">
        <Building2 className="h-10 w-10 text-blue-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Create your organisation</h2>
        <p className="text-gray-500 text-sm mt-1">This will be your team's workspace</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-500 mb-1">Organisation Name</label>
        <Input
          type="text"
          placeholder="Acme Inc."
          value={orgName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrgName(e.target.value)}
          autoFocus
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-500 text-white border-0"
        disabled={loading || !orgName.trim()}
      >
        {loading ? 'Creating...' : 'Create Organisation'}
        {!loading && <ArrowRight className="h-4 w-4 ml-1" />}
      </Button>
    </form>
  )
}

function InviteTeamStep({ tenantSlug: _tenantSlug, onComplete }: InviteTeamStepProps) {
  const [emails, setEmails] = useState<InviteRow[]>([{ email: '', role: 'member' }])
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<InviteResult[]>([])
  const [error, setError] = useState('')

  const addRow = () => {
    setEmails((prev) => [...prev, { email: '', role: 'member' }])
  }

  const removeRow = (index: number) => {
    setEmails((prev) => prev.filter((_, i) => i !== index))
  }

  const updateRow = (index: number, field: keyof InviteRow, value: string) => {
    setEmails((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const handleInvite = async () => {
    const valid = emails.filter((e) => e.email.trim())
    if (valid.length === 0) {
      onComplete()
      return
    }

    setError('')
    setSending(true)
    const inviteResults: InviteResult[] = []

    for (const { email, role } of valid) {
      try {
        const data = await apiFetch<InviteResponse>('/auth/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), role }),
        })
        inviteResults.push({
          email: email.trim(),
          ok: true,
          message: `Invited (token: ${data.invite_token?.slice(0, 8)}...)`,
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed'
        inviteResults.push({ email: email.trim(), ok: false, message })
      }
    }

    setResults(inviteResults)
    setSending(false)
  }

  const allSent = results.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center mb-2">
        <Users className="h-10 w-10 text-blue-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Invite your team</h2>
        <p className="text-gray-500 text-sm mt-1">You can always invite more people later</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {!allSent && (
        <>
          <div className="flex flex-col gap-2">
            {emails.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={row.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateRow(i, 'email', e.target.value)
                  }
                  className="flex-1"
                />
                <select
                  value={row.role}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    updateRow(i, 'role', e.target.value)
                  }
                  className="h-8 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 outline-none"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                {emails.length > 1 && (
                  <button
                    onClick={() => removeRow(i)}
                    className="text-gray-600 hover:text-gray-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addRow}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3 w-3" />
            Add another
          </button>

          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              className="flex-1 border-gray-700 text-gray-400 hover:text-white"
              onClick={onComplete}
            >
              Skip for now
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white border-0"
              onClick={handleInvite}
              disabled={sending}
            >
              {sending ? 'Sending...' : 'Send Invites'}
              {!sending && <Send className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </>
      )}

      {allSent && (
        <>
          <div className="flex flex-col gap-1">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                  r.ok
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                <span>{r.email}</span>
                <span>{r.message}</span>
              </div>
            ))}
          </div>

          <Button
            className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white border-0"
            onClick={onComplete}
          >
            Continue to Dashboard
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </>
      )}
    </div>
  )
}

export default function OrgOnboarding() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { selectTenant } = useAuth()
  const [step, setStep] = useState(1)
  const [tenantSlug, setTenantSlug] = useState('')

  const handleOrgCreated = (slug: string) => {
    setTenantSlug(slug)
    selectTenant(slug)
    setStep(2)
  }

  const handleComplete = async () => {
    await queryClient.invalidateQueries({ queryKey: ['tenants'] })
    navigate({ to: '/dashboard' })
  }

  return (
    <div className="h-full flex items-center justify-center bg-black overflow-y-auto">
      <div className="w-full max-w-md px-6 py-10">
        {/* Brand */}
        <div className="text-center mb-6">
          <span
            style={{ fontFamily: 'Roboto, sans-serif', letterSpacing: '-0.03em' }}
            className="text-3xl font-black text-white"
          >
            KRepo
          </span>
        </div>

        <StepIndicator step={step} />

        {step === 1 && <CreateOrgStep onComplete={handleOrgCreated} />}
        {step === 2 && <InviteTeamStep tenantSlug={tenantSlug} onComplete={handleComplete} />}

        <p className="text-center text-xs text-gray-600 mt-8">
          Wrong account?{' '}
          <button
            className="text-blue-500 hover:text-blue-400"
            onClick={async () => {
              await signOut(auth)
              navigate({ to: '/login' })
            }}
          >
            Change account
          </button>
        </p>
      </div>
    </div>
  )
}
