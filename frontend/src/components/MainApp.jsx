import { useState } from 'react'
import {
  MessageSquare,
  Database,
  Puzzle,
  CheckSquare,
  GraduationCap,
  Settings,
  LogIn,
  UserPlus,
  Link2,
} from 'lucide-react'
import Chat from '@/components/Chat'
import DocumentUpload from '@/components/DocumentUpload'
import IntegrationsPage from '@/components/IntegrationsPage'
import TasksPage from '@/components/TasksPage'
import OnboardingEmployee from '@/components/OnboardingEmployee'
import LoginPage from '@/components/LoginPage'
import SignupPage from '@/components/SignupPage'

const NAV = [
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'repository', label: 'Repository', Icon: Database },
  { id: 'integrations', label: 'Integrations', Icon: Puzzle },
  { id: 'tasks', label: 'Tasks', Icon: CheckSquare },
  { id: 'onboarding', label: 'Onboarding', Icon: GraduationCap },
]

const BOTTOM_NAV = [
  { id: 'settings', label: 'Settings', Icon: Settings },
  { id: 'login', label: 'Log In', Icon: LogIn },
  { id: 'signup', label: 'Sign Up', Icon: UserPlus },
  { id: 'oauth', label: 'OAuth', Icon: Link2 },
]

function RepositoryPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <DocumentUpload />
      </div>
      <div className="m-4 mt-0 rounded-xl border border-dashed border-gray-800 p-8 text-center shrink-0">
        <p className="text-sm font-medium text-gray-500">Visualizations</p>
        <p className="text-xs text-gray-700 mt-1">Coming soon</p>
      </div>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="h-full flex items-center justify-center bg-black">
      <div className="text-center">
        <Settings className="h-10 w-10 text-gray-700 mx-auto mb-3" />
        <p className="text-gray-500 text-sm font-medium">Settings</p>
        <p className="text-gray-700 text-xs mt-1">Coming soon</p>
      </div>
    </div>
  )
}

function NavItem({ id, label, icon, small, active, onSelect }) {
  const isActive = active === id
  const Icon = icon
  return (
    <button
      onClick={() => onSelect(id)}
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
    </button>
  )
}

export default function MainApp() {
  const [active, setActive] = useState('chat')

  const navigate = (id) => setActive(id)

  return (
    <div className="flex h-screen w-screen bg-black">
      {/* Sidebar */}
      <aside className="flex flex-col w-52 shrink-0 border-r border-gray-900 bg-[#0a0a0a]">
        {/* Brand */}
        <div className="px-5 py-[18px] border-b border-gray-900">
          <span
            style={{ fontFamily: 'Roboto, sans-serif', letterSpacing: '-0.03em' }}
            className="text-xl font-black text-white"
          >
            KRepo
          </span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 p-3 flex flex-col gap-0.5 mt-1">
          {NAV.map(({ id, label, Icon }) => (
            <NavItem
              key={id}
              id={id}
              label={label}
              icon={Icon}
              active={active}
              onSelect={setActive}
            />
          ))}
        </nav>

        {/* Bottom nav */}
        <div className="p-3 border-t border-gray-900 flex flex-col gap-0.5">
          {BOTTOM_NAV.map(({ id, label, Icon }) => (
            <NavItem
              key={id}
              id={id}
              label={label}
              icon={Icon}
              small
              active={active}
              onSelect={setActive}
            />
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden dark">
        {active === 'chat' && <Chat />}
        {active === 'repository' && <RepositoryPage />}
        {active === 'integrations' && <IntegrationsPage />}
        {active === 'tasks' && <TasksPage />}
        {active === 'onboarding' && <OnboardingEmployee />}
        {active === 'settings' && <SettingsPage />}
        {active === 'login' && <LoginPage onNavigate={navigate} />}
        {active === 'signup' && <SignupPage onNavigate={navigate} />}
        {active === 'oauth' && <LoginPage onNavigate={navigate} />}
      </main>
    </div>
  )
}
