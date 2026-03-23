import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Integration {
  id: string
  name: string
  letter: string
  iconColor: string
  description: string
}

interface IntegrationIconProps {
  letter: string
  iconColor: string
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    letter: 'S',
    iconColor: '#E01E5A',
    description:
      'Sync messages, threads, and knowledge from your Slack workspaces directly into your knowledge base.',
  },
  {
    id: 'jira',
    name: 'JIRA',
    letter: 'J',
    iconColor: '#2684FF',
    description:
      'Pull in tickets, epics, sprints, and project context from your Atlassian JIRA boards.',
  },
  {
    id: 'confluence',
    name: 'Confluence',
    letter: 'C',
    iconColor: '#2684FF',
    description: 'Ingest documentation, wiki pages, and team knowledge from Confluence spaces.',
  },
  {
    id: 'notion',
    name: 'Notion',
    letter: 'N',
    iconColor: '#9b9b9b',
    description: 'Connect Notion workspaces to import docs, databases, and team notes seamlessly.',
  },
]

function IntegrationIcon({ letter, iconColor }: IntegrationIconProps): React.JSX.Element {
  return (
    <div
      style={{
        background: iconColor + '18',
        border: `1px solid ${iconColor}35`,
      }}
      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
    >
      <span
        style={{ color: iconColor, fontFamily: 'Roboto, sans-serif' }}
        className="text-xl font-black"
      >
        {letter}
      </span>
    </div>
  )
}

export default function IntegrationsPage(): React.JSX.Element {
  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <h1
          style={{ fontFamily: 'Roboto, sans-serif' }}
          className="text-2xl font-bold text-white mb-1"
        >
          Integrations
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Connect your tools to enrich KRepo's knowledge base.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {INTEGRATIONS.map((integration) => (
            <Card
              key={integration.id}
              className="bg-[#0f0f0f] border-gray-800 hover:border-gray-700 transition-colors"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <IntegrationIcon letter={integration.letter} iconColor={integration.iconColor} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-white">{integration.name}</h3>
                      <Badge variant="outline" className="text-xs text-gray-600 border-gray-700">
                        Not connected
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {integration.description}
                    </p>
                    <Button
                      size="sm"
                      className="mt-4 bg-blue-600 hover:bg-blue-500 text-white border-0"
                    >
                      Connect
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
