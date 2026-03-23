import { MessageSquare, Database, Puzzle, CheckSquare, GraduationCap, Settings } from 'lucide-react'
import { Link, Outlet, useMatchRoute } from '@tanstack/react-router'

const NAV = [
  { to: '/dashboard/chat', label: 'Chat', Icon: MessageSquare },
  { to: '/dashboard/repository', label: 'Repository', Icon: Database },
  { to: '/dashboard/integrations', label: 'Integrations', Icon: Puzzle },
  { to: '/dashboard/tasks', label: 'Tasks', Icon: CheckSquare },
  { to: '/dashboard/onboarding', label: 'Onboarding', Icon: GraduationCap },
]

const BOTTOM_NAV = [{ to: '/dashboard/settings', label: 'Settings', Icon: Settings }]

function NavItem({ to, label, Icon, small }) {
  const matchRoute = useMatchRoute()
  const isActive = !!matchRoute({ to })

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 rounded-lg font-medium transition-colors w-full text-left ${
        small ? 'py-2 text-xs' : 'py-2.5 text-sm'
      } ${
        isActive
          ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
          : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
      {label}
    </Link>
  )
}

export default function DashboardLayout() {
  return (
    <div className="flex h-full w-full bg-black">
      {/* Sidebar */}
      <aside className="flex flex-col w-52 shrink-0 border-r border-gray-900 bg-[#0a0a0a]">
        {/* Brand */}
        <div className="px-5 py-[18px] border-b border-gray-900">
          <Link
            to="/"
            style={{ fontFamily: 'Roboto, sans-serif', letterSpacing: '-0.03em' }}
            className="text-xl font-black text-white"
          >
            KRepo
          </Link>
        </div>

        {/* Main nav */}
        <nav className="flex-1 p-3 flex flex-col gap-0.5 mt-1">
          {NAV.map(({ to, label, Icon }) => (
            <NavItem key={to} to={to} label={label} Icon={Icon} />
          ))}
        </nav>

        {/* Bottom nav */}
        <div className="p-3 border-t border-gray-900 flex flex-col gap-0.5">
          {BOTTOM_NAV.map(({ to, label, Icon }) => (
            <NavItem key={to} to={to} label={label} Icon={Icon} small />
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
