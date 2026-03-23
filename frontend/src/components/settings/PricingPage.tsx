import { Check, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    description: 'For small teams getting started',
    features: [
      '5 team members',
      '1 GB document storage',
      '100 chat queries / day',
      'Community support',
    ],
    current: true,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/ seat / mo',
    description: 'For growing teams with more needs',
    features: [
      'Unlimited members',
      '50 GB document storage',
      'Unlimited chat queries',
      'GitHub, Slack, Jira integrations',
      'Priority support',
      'Custom learning paths',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Dedicated infra, compliance & SLAs',
    features: [
      'Everything in Pro',
      'Dedicated database',
      'SOC2 compliance',
      'SSO / SAML',
      'Audit logs',
      'Dedicated account manager',
      '99.9% SLA',
    ],
  },
]

export default function PricingPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Plans & Billing</h3>
        <p className="text-xs text-muted-foreground">
          Choose a plan that fits your team. Upgrade or downgrade at any time.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={
              plan.highlighted
                ? 'relative ring-1 ring-blue-500/40 shadow-[0_0_24px_-6px_rgba(59,130,246,0.15)]'
                : ''
            }
          >
            {plan.highlighted && (
              <div className="absolute -top-2.5 left-4">
                <Badge className="gap-1 bg-blue-600 text-[10px] text-white hover:bg-blue-600">
                  <Sparkles className="h-2.5 w-2.5" />
                  Popular
                </Badge>
              </div>
            )}
            <CardContent className="p-5 flex flex-col h-full">
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground">{plan.name}</p>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className="text-2xl font-bold tracking-tight">{plan.price}</span>
                  {plan.period && (
                    <span className="text-xs text-muted-foreground">{plan.period}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{plan.description}</p>
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs">
                    <Check className="h-3 w-3 mt-0.5 shrink-0 text-green-400" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {plan.current ? (
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : plan.highlighted ? (
                  <Button size="sm" className="w-full gap-1.5">
                    <Zap className="h-3 w-3" />
                    Upgrade
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="w-full">
                    Contact sales
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
