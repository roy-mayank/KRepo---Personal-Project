import { useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import {
  useIntegrationConnections,
  useConnectIntegration,
  useSyncIntegration,
  useDisconnectIntegration,
  useSyncStatus,
  type IntegrationConnection,
} from '@/lib/queries'
import { useQueryClient } from '@tanstack/react-query'

interface Integration {
  id: string
  name: string
  letter: string
  iconColor: string
  description: string
  oauthEnabled: boolean
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'notion',
    name: 'Notion',
    letter: 'N',
    iconColor: '#9b9b9b',
    description: 'Connect Notion workspaces to import docs, databases, and team notes seamlessly.',
    oauthEnabled: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    letter: 'S',
    iconColor: '#E01E5A',
    description:
      'Sync messages, threads, and knowledge from your Slack workspaces directly into your knowledge base.',
    oauthEnabled: false,
  },
  {
    id: 'jira',
    name: 'JIRA',
    letter: 'J',
    iconColor: '#2684FF',
    description:
      'Pull in tickets, epics, sprints, and project context from your Atlassian JIRA boards.',
    oauthEnabled: false,
  },
  {
    id: 'confluence',
    name: 'Confluence',
    letter: 'C',
    iconColor: '#2684FF',
    description: 'Ingest documentation, wiki pages, and team knowledge from Confluence spaces.',
    oauthEnabled: false,
  },
]

function IntegrationIcon({
  letter,
  iconColor,
}: {
  letter: string
  iconColor: string
}): React.JSX.Element {
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

function IntegrationCard({
  integration,
  connection,
  syncStatus,
}: {
  integration: Integration
  connection: IntegrationConnection | undefined
  syncStatus: string | undefined
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const connectMutation = useConnectIntegration()
  const syncMutation = useSyncIntegration()
  const disconnectMutation = useDisconnectIntegration()

  const isConnected = connection?.status === 'active'
  const isSyncing = syncStatus === 'running' || syncStatus === 'started'

  const handleConnect = useCallback(async () => {
    if (!integration.oauthEnabled) return
    try {
      const { authorize_url } = await connectMutation.mutateAsync(integration.id)
      const popup = window.open(authorize_url, '_blank', 'popup,width=600,height=700')

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'oauth_success' && event.data.provider === integration.id) {
          queryClient.invalidateQueries({ queryKey: ['integrations', 'connections'] })
          window.removeEventListener('message', onMessage)
        }
        if (event.data?.type === 'oauth_error') {
          window.removeEventListener('message', onMessage)
        }
      }
      window.addEventListener('message', onMessage)

      // Fallback: if popup is closed without postMessage, re-check after a delay
      const interval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(interval)
          window.removeEventListener('message', onMessage)
          queryClient.invalidateQueries({ queryKey: ['integrations', 'connections'] })
        }
      }, 1000)
    } catch {
      // mutation error handled by TanStack Query
    }
  }, [integration.id, integration.oauthEnabled, connectMutation, queryClient])

  const handleSync = useCallback(() => {
    syncMutation.mutate(integration.id)
  }, [integration.id, syncMutation])

  const handleDisconnect = useCallback(() => {
    if (window.confirm(`Disconnect ${integration.name}? This will remove all synced data.`)) {
      disconnectMutation.mutate(integration.id)
    }
  }, [integration.id, integration.name, disconnectMutation])

  return (
    <Card className="bg-[#0f0f0f] border-gray-800 hover:border-gray-700 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <IntegrationIcon letter={integration.letter} iconColor={integration.iconColor} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="font-semibold text-white">{integration.name}</h3>
              {isConnected ? (
                <Badge className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-gray-600 border-gray-700">
                  Not connected
                </Badge>
              )}
            </div>

            {isConnected && connection?.workspace_name && (
              <p className="text-xs text-gray-500 mb-1">{connection.workspace_name}</p>
            )}

            <p className="text-sm text-gray-400 leading-relaxed">{integration.description}</p>

            {isSyncing && (
              <div className="flex items-center gap-2 mt-2 text-xs text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Syncing...</span>
              </div>
            )}
            {syncStatus && syncStatus.startsWith('completed') && (
              <p className="mt-2 text-xs text-emerald-400">{syncStatus}</p>
            )}
            {syncStatus && syncStatus.startsWith('error') && (
              <p className="mt-2 text-xs text-red-400">{syncStatus}</p>
            )}

            <div className="flex gap-2 mt-4">
              {isConnected ? (
                <>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-500 text-white border-0"
                    onClick={handleSync}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin mr-1" /> Syncing
                      </>
                    ) : (
                      'Sync'
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-800"
                    onClick={handleDisconnect}
                    disabled={disconnectMutation.isPending}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-500 text-white border-0"
                  onClick={handleConnect}
                  disabled={!integration.oauthEnabled || connectMutation.isPending}
                >
                  {connectMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : null}
                  {integration.oauthEnabled ? 'Connect' : 'Coming soon'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function IntegrationsPage(): React.JSX.Element {
  const { data: connections = [] } = useIntegrationConnections()
  const { data: syncStatusData } = useSyncStatus()
  const syncStatuses = syncStatusData?.status ?? {}

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
            <IntegrationCard
              key={integration.id}
              integration={integration}
              connection={connections.find((c) => c.provider === integration.id)}
              syncStatus={syncStatuses[integration.id]}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
