import { useState } from 'react'
import { Users, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import OnboardingManager from './OnboardingManager'
import OnboardingEmployee from './OnboardingEmployee'

export default function Onboarding() {
  const [role, setRole] = useState(null) // null | 'manager' | 'employee'

  if (role === 'manager') return <OnboardingManager onBack={() => setRole(null)} />
  if (role === 'employee') return <OnboardingEmployee onBack={() => setRole(null)} />

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Onboarding</h2>
        <p className="mt-1 text-sm text-muted-foreground">How are you using this today?</p>
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-4">
        <Card
          className="cursor-pointer transition-colors hover:bg-muted/50"
          onClick={() => setRole('manager')}
        >
          <CardContent className="flex flex-col items-center gap-3 p-6">
            <Users className="h-8 w-8 text-primary" />
            <div className="text-center">
              <p className="font-medium">Manager / Team Lead</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create and assign onboarding tasks to team members
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-colors hover:bg-muted/50"
          onClick={() => setRole('employee')}
        >
          <CardContent className="flex flex-col items-center gap-3 p-6">
            <User className="h-8 w-8 text-primary" />
            <div className="text-center">
              <p className="font-medium">Team Member</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start your assigned onboarding and build your learning path
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
