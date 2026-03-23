import { RouterProvider } from '@tanstack/react-router'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { router } from './router'

function InnerApp() {
  const auth = useAuth()

  if (auth.loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    )
  }

  return <RouterProvider router={router} context={{ auth }} />
}

export default function App() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  )
}
