import { Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { CreditCard, type LucideIcon, User, Users } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SettingsNavItem {
  to: string
  label: string
  Icon: LucideIcon
}

const NAV: SettingsNavItem[] = [
  { to: '/dashboard/settings/account', label: 'Account', Icon: User },
  { to: '/dashboard/settings/members', label: 'Members', Icon: Users },
  { to: '/dashboard/settings/pricing', label: 'Pricing', Icon: CreditCard },
]

export default function SettingsLayout(): React.JSX.Element {
  const matchRoute = useMatchRoute()

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your account, team, and billing
          </p>
        </div>

        {/* Sub-navigation */}
        <nav className="flex gap-1 border-b border-border/50 mb-6">
          {NAV.map(({ to, label, Icon }) => {
            const isActive = !!matchRoute({ to })
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            )
          })}
        </nav>

        <Outlet />
      </div>
    </ScrollArea>
  )
}
