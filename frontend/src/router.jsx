import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router'

import LandingPage from '@/components/LandingPage'
import LoginPage from '@/components/LoginPage'
import SignupPage from '@/components/SignupPage'
import OrgOnboarding from '@/components/OrgOnboarding'
import DashboardLayout from '@/components/DashboardLayout'
import Chat from '@/components/Chat'
import DocumentUpload from '@/components/DocumentUpload'
import IntegrationsPage from '@/components/IntegrationsPage'
import TasksPage from '@/components/TasksPage'
import OnboardingEmployee from '@/components/OnboardingEmployee'
import SettingsPage from '@/components/SettingsPage'

// Root
const rootRoute = createRootRoute({
  component: () => (
    <div className="h-screen overflow-hidden bg-black">
      <Outlet />
    </div>
  ),
})

// Public routes
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: SignupPage,
})

// Org onboarding — must be logged in but no org yet
const onboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboard',
  component: OrgOnboarding,
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' })
    }
    // Already has an org? Go to dashboard
    if (context.auth.hasOrg) {
      throw redirect({ to: '/dashboard' })
    }
  },
})

// Dashboard layout — must be logged in AND have an org
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardLayout,
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' })
    }
    if (!context.auth.hasOrg) {
      throw redirect({ to: '/onboard' })
    }
  },
})

// Dashboard children
const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/dashboard/chat' })
  },
})

const chatRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/chat',
  component: Chat,
})

const repositoryRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/repository',
  component: () => (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <DocumentUpload />
      </div>
      <div className="m-4 mt-0 rounded-xl border border-dashed border-gray-800 p-8 text-center shrink-0">
        <p className="text-sm font-medium text-gray-500">Visualizations</p>
        <p className="text-xs text-gray-700 mt-1">Coming soon</p>
      </div>
    </div>
  ),
})

const integrationsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/integrations',
  component: IntegrationsPage,
})

const tasksRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/tasks',
  component: TasksPage,
})

const onboardingRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/onboarding',
  component: OnboardingEmployee,
})

const settingsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/settings',
  component: SettingsPage,
})

// Build route tree
const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRoute,
  signupRoute,
  onboardRoute,
  dashboardRoute.addChildren([
    dashboardIndexRoute,
    chatRoute,
    repositoryRoute,
    integrationsRoute,
    tasksRoute,
    onboardingRoute,
    settingsRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  context: { auth: undefined },
})
