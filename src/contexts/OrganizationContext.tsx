import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAppConfig, type AppConfig } from '@/hooks/useAppConfig'

export type OrganizationFeatures = AppConfig['features']

interface OrganizationContextValue {
  features: OrganizationFeatures
  isLoading: boolean
}

const DEFAULT_FEATURES: OrganizationFeatures = {
  enableAIChat: true,
  enableKnowledgeBase: true,
  enableMeetings: true,
  enableTasks: true,
  enableNotifications: true,
  enableSemanticSearch: true,
  enableClients: true,
  enableAIAgents: true,
  enablePersonalKnowledge: true,
  enableFeedback: true,
  enableGoogleDrive: false,
  enableZoomSync: false,
  useGenericMeetings: false,
  enableFourSpaces: false,
  enableAutomations: true,
  enableKbCohere: false,
  enableKbSlack: false,
  enableKbOcr: false,
  enableKbParserAdvanced: false,
  enableKbMemoryDecay: false,
  enableGraphify: false,
}

const OrganizationContext = createContext<OrganizationContextValue>({
  features: DEFAULT_FEATURES,
  isLoading: true,
})

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { data: config, isLoading } = useAppConfig()

  const value = useMemo<OrganizationContextValue>(
    () => ({
      features: { ...DEFAULT_FEATURES, ...config?.features },
      isLoading,
    }),
    [config?.features, isLoading]
  )

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  return useContext(OrganizationContext)
}
