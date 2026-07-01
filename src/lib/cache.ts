/**
 * Query key factories for React Query
 * Provides consistent cache keys across the application
 */

export const queryKeys = {
  // Auth
  auth: {
    user: ["auth", "user"] as const,
    session: ["auth", "session"] as const,
  },

  // Clients
  clients: {
    all: ["clients"] as const,
    list: (filters?: Record<string, any>) => ["clients", "list", filters] as const,
    detail: (id: string) => ["clients", "detail", id] as const,
    stats: (clientIds: string[]) => ["clients", "stats", clientIds] as const,
  },

  // Meetings
  meetings: {
    all: ["meetings"] as const,
    list: (filters?: Record<string, any>) => ["meetings", "list", filters] as const,
    detail: (id: string) => ["meetings", "detail", id] as const,
    zoom: (meetingId: string) => ["meetings", "zoom", meetingId] as const,
    // Participants & External Participants
    participants: (meetingId: string) => ["meetings", "participants", meetingId] as const,
    externalParticipants: (meetingId: string) => ["meetings", "externalParticipants", meetingId] as const,
    // Agenda & Takeaways
    agenda: (meetingId: string) => ["meetings", "agenda", meetingId] as const,
    takeaways: (meetingId: string) => ["meetings", "takeaways", meetingId] as const,
    // Action Items
    actionItems: (meetingId: string) => ["meetings", "actionItems", meetingId] as const,
    // Series
    series: (seriesId: string) => ["meetings", "series", seriesId] as const,
    seriesList: ["meetings", "seriesList"] as const,
    // Transcripts & Files
    transcripts: (filters?: Record<string, any>) => ["meetings", "transcripts", filters] as const,
    transcript: (meetingId: string) => ["meetings", "transcript", meetingId] as const,
    files: (meetingId: string) => ["meetings", "files", meetingId] as const,
    fileSummary: (fileId: string) => ["meetings", "fileSummary", fileId] as const,
    transcriptSummary: (meetingId: string) => ["meetings", "transcriptSummary", meetingId] as const,
    // Categorizations & AI
    categorizations: (meetingId: string) => ["meetings", "categorizations", meetingId] as const,
    categorizationStatus: ["meetings", "categorizationStatus"] as const,
    // Assignments & Suggestions
    assignments: (meetingId: string) => ["meetings", "assignments", meetingId] as const,
    assignmentSuggestions: (meetingId: string) => ["meetings", "assignmentSuggestions", meetingId] as const,
    pendingAssignments: (filters?: Record<string, any>) => ["meetings", "pendingAssignments", filters] as const,
    pendingAssignmentCount: ["meetings", "pendingAssignmentCount"] as const,
    // Search & Calendar
    search: (query: string, filters?: Record<string, any>) => ["meetings", "search", query, filters] as const,
    calendar: (dateRange: { start: string; end: string }) => ["meetings", "calendar", dateRange] as const,
    // Efficiency
    efficiency: (meetingId: string) => ["meetings", "efficiency", meetingId] as const,
    // Entity-based views
    clientMeetings: (clientId: string) => ["meetings", "client", clientId] as const,
    projectMeetings: (projectId: string) => ["meetings", "project", projectId] as const,
    dealMeetings: (dealId: string) => ["meetings", "deal", dealId] as const,
    contactMeetings: (contactId: string) => ["meetings", "contact", contactId] as const,
    entityMeetings: (entityType: string, entityId: string) => ["meetings", "entity", entityType, entityId] as const,
    // Knowledge base integration
    knowledgeMeetings: (filters?: Record<string, any>) => ["meetings", "knowledge", filters] as const,
    /** Fellow.ai proxy (Edge Function fellow-api) */
    fellow: {
      recordings: (limit: number) => ["meetings", "fellow", "recordings", limit] as const,
      notes: (limit: number) => ["meetings", "fellow", "notes", limit] as const,
      actionItems: (limit: number) => ["meetings", "fellow", "action-items", limit] as const,
    },
  },

  // Knowledge Base
  knowledge: {
    all: ["knowledge"] as const,
    entries: (filters?: Record<string, any>) => ["knowledge", "entries", filters] as const,
    entry: (id: string) => ["knowledge", "entry", id] as const,
    categories: ["knowledge", "categories"] as const,
    category: (id: string) => ["knowledge", "category", id] as const,
    search: (query: string) => ["knowledge", "search", query] as const,
    files: (filters?: Record<string, any>) => ["knowledge", "files", filters] as const,
    sources: ["knowledge", "sources"] as const,
    stats: ["knowledge", "stats"] as const,
    unifiedDocuments: (filters?: Record<string, any>) => ["knowledge", "unifiedDocuments", filters] as const,
    semanticSearch: (query: string, opts?: Record<string, any>) => ["knowledge", "semanticSearch", query, opts] as const,
    userKnowledgeStats: (userId: string) => ["knowledge", "userStats", userId] as const,
    agentPersonalizations: (userId: string) => ["knowledge", "agentPersonalizations", userId] as const,
    dashboard: ["knowledge", "dashboard"] as const,
    dashboardFiles: ["knowledge", "dashboard", "files"] as const,
    dashboardSources: ["knowledge", "dashboard", "sources"] as const,
    dashboardSyncLogs: ["knowledge", "dashboard", "syncLogs"] as const,
    dashboardSearchLogs: ["knowledge", "dashboard", "searchLogs"] as const,
    dashboardCommonCount: ["knowledge", "dashboard", "commonCount"] as const,
    sourceConfig: ["knowledge", "sourceConfig"] as const,
    globalReranker: ["knowledge", "globalReranker"] as const,
    ragPlayground: ["knowledge", "ragPlayground"] as const,
    bulkReembed: (jobId: string) => ["knowledge", "bulkReembed", jobId] as const,
    permissions: ["knowledge", "permissions"] as const,
    health: ["knowledge", "health"] as const,
    ocrQuality: ["knowledge", "ocrQuality"] as const,
    slackChannels: ["knowledge", "slackChannels"] as const,
    slackSyncLedger: (limit: number) => ["knowledge", "slackSyncLedger", limit] as const,
    userSearchHistory: (userId: string, limit: number) =>
      ["knowledge", "userSearchHistory", userId, limit] as const,
    memoryDecay: (userId: string) => ["knowledge", "memoryDecay", userId] as const,
    memoryAdmin: (action: string, ...args: (string | undefined)[]) =>
      ["knowledge", "memoryAdmin", action, ...args.filter(Boolean)] as const,
  },

  graphify: {
    all: ["graphify"] as const,
    search: (query: string) => ["graphify", "search", query] as const,
    suggestions: (query: string) => ["graphify", "suggestions", query] as const,
    traverse: (
      seedIds: string[],
      depth: number,
      entityTypes: string[] = [],
      relationshipTypes: string[] = []
    ) => ["graphify", "traverse", seedIds, depth, entityTypes, relationshipTypes] as const,
    entity: (id: string) => ["graphify", "entity", id] as const,
    neighbors: (id: string) => ["graphify", "neighbors", id] as const,
    config: ["graphify", "config"] as const,
    stats: ["graphify", "stats"] as const,
    analytics: (days: number) => ["graphify", "analytics", days] as const,
    coverage: ["graphify", "coverage"] as const,
    syncJobs: ["graphify", "syncJobs"] as const,
  },

  // Zoho CRM (deal-scoped cache)
  // EOS Module
  eos: {
    all: ["eos"] as const,
    dashboard: (filters?: Record<string, unknown>) => ["eos", "dashboard", filters] as const,
    vto: ["eos", "vto"] as const,
    vtoVersions: (section: string) => ["eos", "vto", "versions", section] as const,
    okrs: (filters?: Record<string, unknown>) => ["eos", "okrs", filters] as const,
    issues: (filters?: Record<string, unknown>) => ["eos", "issues", filters] as const,
    issue: (id: string) => ["eos", "issues", id] as const,
    issueComments: (issueId: string) => ["eos", "issues", issueId, "comments"] as const,
    issueInsights: (days: number) => ["eos", "issue-insights", days] as const,
    scorecards: ["eos", "scorecards"] as const,
    scorecard: (id: string) => ["eos", "scorecards", id] as const,
    pods: ["eos", "pods"] as const,
    accountability: ["eos", "accountability"] as const,
    peopleReviews: (filters?: Record<string, unknown>) => ["eos", "people-reviews", filters] as const,
    todos: (filters?: Record<string, unknown>) => ["eos", "todos", filters] as const,
    l10Sections: (meetingId: string) => ["eos", "l10", meetingId] as const,
    teamHealth: ["eos", "team-health"] as const,
    analytics: (period: string) => ["eos", "analytics", period] as const,
    notificationPrefs: (userId: string) => ["eos", "notification-prefs", userId] as const,
  },

  zoho: {
    attachments: (dealId: string) => ["zoho", "attachments", dealId] as const,
    engagements: (dealId: string) => ["zoho", "engagements", dealId] as const,
    events: (dealId: string) => ["zoho", "events", dealId] as const,
    contactEnrichment: (dealId: string) => ["zoho", "contact-enrichment", dealId] as const,
    accountEnrichment: (dealId: string) => ["zoho", "account-enrichment", dealId] as const,
  },

  // Deals
  deals: {
    all: ["deals"] as const,
    list: (filters?: Record<string, any>) => ["deals", "list", filters] as const,
    detail: (slug: string) => ["deals", "detail", slug] as const,
    pipelineStats: ["deals", "pipeline-stats"] as const,
    analytics: ["deals", "analytics"] as const,
    revenueProjection: (year?: number) => ["deals", "revenue-projection", year ?? new Date().getFullYear()] as const,
    overviewExtra: ["deals", "overview-extra"] as const,
    activities: (dealId: string) => ["deals", "activities", dealId] as const,
    comments: (dealId: string) => ["deals", "comments", dealId] as const,
  },

  // Tasks
  tasks: {
    all: ["tasks"] as const,
    list: (filters?: Record<string, any>) => ["tasks", "list", filters] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
    // V2 / My Tasks views
    listV2: (filters?: Record<string, any>) => ["tasks", "listV2", filters] as const,
    detailBySlug: (slug: string) => ["tasks", "detailBySlug", slug] as const,
    today: (userId: string, search?: string) => ["tasks", "today", userId, search] as const,
    thisWeek: (userId: string, search?: string) => ["tasks", "thisWeek", userId, search] as const,
    weekOffset: (userId: string, weekOffset: number, search?: string) =>
      ["tasks", "week", userId, weekOffset, search] as const,
    overdue: (userId: string, search?: string) => ["tasks", "overdue", userId, search] as const,
    delegated: (userId: string, search?: string) => ["tasks", "delegated", userId, search] as const,
    allMine: (userId: string, search?: string) => ["tasks", "allMine", userId, search] as const,
    streams: ["tasks", "streams"] as const,
    streamBySlug: (slugOrId: string) => ["tasks", "stream", slugOrId] as const,
    streamCounts: ["tasks", "streamCounts"] as const,
    streamTasks: (streamId: string, filters?: Record<string, any>) =>
      ["tasks", "streamTasks", streamId, filters] as const,
    subTasks: (parentId: string) => ["tasks", "subTasks", parentId] as const,
    comments: (taskId: string) => ["tasks", "comments", taskId] as const,
    contributors: (taskId: string) => ["tasks", "contributors", taskId] as const,
    stats: ["tasks", "stats"] as const,
  },

  // AI
  ai: {
    agents: ["ai", "agents"] as const,
    agent: (id: string) => ["ai", "agent", id] as const,
    agentCategories: ["ai", "agentCategories"] as const,
    runs: (agentId: string) => ["ai", "runs", agentId] as const,
    dashboardStats: ["ai", "dashboardStats"] as const,
    agentAnalytics: (days: number) => ["ai", "agentAnalytics", days] as const,
    agentAnalyticsDetail: (agentId: string, days: number) =>
      ["ai", "agentAnalyticsDetail", agentId, days] as const,
    emailDraftingStats: (days: number) => ["ai", "emailDraftingStats", days] as const,
    dealCoachingStats: (days?: number) => ["ai", "dealCoachingStats", days ?? 90] as const,
    chat: (sessionId: string) => ["ai", "chat", sessionId] as const,
    embeddings: (sourceId: string) => ["ai", "embeddings", sourceId] as const,
    // Conversation threading
    conversations: (agentId: string) => ["ai", "conversations", agentId] as const,
    conversation: (conversationId: string) => ["ai", "conversation", conversationId] as const,
    messages: (conversationId: string) => ["ai", "messages", conversationId] as const,
    allConversations: ["ai", "allConversations"] as const,
    promptTemplates: ["ai", "promptTemplates"] as const,
    promptTemplate: (id: string) => ["ai", "promptTemplate", id] as const,
    agentCatalog: ["ai", "agentCatalog"] as const,
    runAuditLog: (filters?: Record<string, unknown>) =>
      ["ai", "runAuditLog", filters] as const,
    promptVersions: (agentId: string) => ["ai", "promptVersions", agentId] as const,
    learningEvents: (agentId: string) => ["ai", "learningEvents", agentId] as const,
    agentMemoriesAdmin: (agentId: string, userId?: string) =>
      ["ai", "agentMemoriesAdmin", agentId, userId] as const,
    costDashboard: (days: number) => ["ai", "costDashboard", days] as const,
    activeThreads: (userId: string) => ["ai", "activeThreads", userId] as const,
  },

  // Admin
  spaces: {
    preferences: (userId: string) => ["spaces", "preferences", userId] as const,
  },

  admin: {
    users: ["admin", "users"] as const,
    user: (id: string) => ["admin", "user", id] as const,
    roles: ["admin", "roles"] as const,
    permissions: ["admin", "permissions"] as const,
    memoryDashboard: ["admin", "memoryDashboard"] as const,
    userMemoryStats: ["user-memory-stats"] as const,
    teamLearningPatterns: ["admin", "teamLearningPatterns"] as const,
    searchAnalytics: ["admin", "searchAnalytics"] as const,
  },

  // MFA enforcement
  mfa: {
    policy: ["mfa", "policy"] as const,
    enrollment: ["mfa", "enrollment"] as const,
    factors: ["mfa", "factors"] as const,
  },

  // Self-signup domain whitelist
  signupWhitelist: {
    domains: ["signupWhitelist", "domains"] as const,
  },

  // Admin session management
  adminSessions: {
    list: ["adminSessions", "list"] as const,
  },

  // Departments
  departments: {
    all: ["departments"] as const,
    list: (filters?: Record<string, unknown>) => ["departments", "list", filters] as const,
    detail: (id: string) => ["departments", "detail", id] as const,
    users: (id: string) => ["departments", "users", id] as const,
  },

  // SendGrid
  sendgrid: {
    config: ["sendgrid", "config"] as const,
    integration: ["sendgrid", "integration"] as const,
    trackingEvents: (days?: number) => ["sendgrid", "trackingEvents", days] as const,
  },

  // Integration preferences (primary integrations / knowledge sources)
  integrationSettings: {
    all: ["integration-settings"] as const,
    preferences: () => ["integration-settings", "preferences"] as const,
    options: () => ["integration-settings", "options"] as const,
    primaryByCategory: () => ["integration-settings", "primary-by-category"] as const,
    categoryOptions: () => ["integration-settings", "category-options"] as const,
    orgOverview: () => ["integration-settings", "org-overview"] as const,
    aiModelPolicy: () => ["integration-settings", "ai-model-policy"] as const,
    selectableChatModels: () => ["integration-settings", "selectable-chat-models"] as const,
    agentChatModels: () => ["integration-settings", "agent-chat-models"] as const,
  },

  // Notifications
  notifications: {
    all: ["notifications"] as const,
    unread: ["notifications", "unread"] as const,
    count: ["notifications", "count"] as const,
    list: (filters?: Record<string, unknown>) => ["notifications", "list", filters] as const,
    preferences: (userId: string) => ["notifications", "preferences", userId] as const,
    subscriptions: (userId: string) => ["notifications", "subscriptions", userId] as const,
    events: ["notifications", "events"] as const,
    rules: ["notifications", "rules"] as const,
    logs: (filters?: Record<string, unknown>) => ["notifications", "logs", filters] as const,
    adminMetrics: ["notifications", "adminMetrics"] as const,
    templates: ["notifications", "templates"] as const,
  },

  // Automation
  automation: {
    all: ["automation"] as const,
    workflows: (filters?: Record<string, unknown>) => ["automation", "workflows", filters] as const,
    workflow: (id: string) => ["automation", "workflow", id] as const,
    executions: (filters?: Record<string, unknown>) => ["automation", "executions", filters] as const,
    execution: (id: string) => ["automation", "execution", id] as const,
    templates: ["automation", "templates"] as const,
    webhooks: ["automation", "webhooks"] as const,
    analytics: ["automation", "analytics"] as const,
    approvals: ["automation", "approvals"] as const,
  },

  // Dashboard (agency-first)
  dashboard: {
    ownerMetrics: ["dashboard", "ownerMetrics"] as const,
    projectRisks: (filters?: Record<string, any>) => ["dashboard", "projectRisks", filters] as const,
    pmCapacity: (podId?: string) => ["dashboard", "pmCapacity", podId] as const,
    widgets: ["dashboard", "widgets"] as const,
    agencyPreferences: (userId: string) => ["dashboard", "agencyPrefs", userId] as const,
    aiDigest: (userId: string) => ["dashboard", "aiDigest", userId] as const,
    meetingsThisWeek: (userId: string) => ["dashboard", "meetingsThisWeek", userId] as const,
    myTasks: (userId: string, filters?: Record<string, any>) => ["dashboard", "myTasks", userId, filters] as const,
    myProjects: (userId: string) => ["dashboard", "myProjects", userId] as const,
    userPreferences: (userId: string, dashboardType: string) =>
      ["user-dashboard-preferences", userId, dashboardType] as const,
  },
};

/**
 * Cache configuration
 */
export const cacheConfig = {
  staleTime: {
    short: 1000 * 60, // 1 minute
    medium: 1000 * 60 * 5, // 5 minutes
    long: 1000 * 60 * 30, // 30 minutes
    veryLong: 1000 * 60 * 60, // 1 hour
  },
  gcTime: {
    short: 1000 * 60 * 5, // 5 minutes
    medium: 1000 * 60 * 10, // 10 minutes
    long: 1000 * 60 * 30, // 30 minutes
  },
};

/**
 * Cache invalidation helpers
 */
export const invalidateKeys = {
  clients: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
  },
  meetings: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all });
  },
  meetingDetail: (queryClient: any, meetingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.detail(meetingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.participants(meetingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.externalParticipants(meetingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.agenda(meetingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.takeaways(meetingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.actionItems(meetingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.assignments(meetingId) });
  },
  meetingParticipants: (queryClient: any, meetingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.participants(meetingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.externalParticipants(meetingId) });
  },
  meetingAgenda: (queryClient: any, meetingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.agenda(meetingId) });
  },
  meetingTakeaways: (queryClient: any, meetingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.takeaways(meetingId) });
  },
  meetingActionItems: (queryClient: any, meetingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.actionItems(meetingId) });
  },
  meetingAssignments: (queryClient: any, meetingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.assignments(meetingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.assignmentSuggestions(meetingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.pendingAssignmentCount });
  },
  meetingCategorizations: (queryClient: any, meetingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.categorizations(meetingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.categorizationStatus });
  },
  meetingSeries: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.seriesList });
  },
  knowledge: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
  },
  graphify: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.graphify.all });
  },
  deals: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
  },
  tasks: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  },
  taskDetail: (queryClient: any, idOrSlug: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(idOrSlug) });
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detailBySlug(idOrSlug) });
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.listV2(undefined) });
  },
  taskStreams: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.streams });
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.streamCounts });
  },
  roles: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles });
  },
  mfa: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.mfa.policy });
    queryClient.invalidateQueries({ queryKey: queryKeys.mfa.enrollment });
    queryClient.invalidateQueries({ queryKey: queryKeys.mfa.factors });
  },
  signupWhitelist: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.signupWhitelist.domains });
  },
  adminSessions: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminSessions.list });
  },
  departments: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.departments.all });
  },
  ai: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.ai.agents });
    queryClient.invalidateQueries({ queryKey: queryKeys.ai.agentCatalog });
    queryClient.invalidateQueries({ queryKey: ["ai", "agent"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.ai.agentCategories });
  },
  promptTemplates: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.ai.promptTemplates });
  },
  conversations: (queryClient: any, agentId?: string) => {
    if (agentId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.conversations(agentId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.ai.allConversations });
  },
  messages: (queryClient: any, conversationId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.ai.messages(conversationId) });
  },
  notifications: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.count });
    queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
  },
  notificationPreferences: (queryClient: any, userId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences(userId) });
  },
  notificationSubscriptions: (queryClient: any, userId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.subscriptions(userId) });
  },
  notificationAdmin: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.rules });
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.adminMetrics });
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.templates });
    queryClient.invalidateQueries({ queryKey: ["notifications", "logs"] });
  },
  sendgrid: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sendgrid.config });
    queryClient.invalidateQueries({ queryKey: queryKeys.sendgrid.integration });
    queryClient.invalidateQueries({ queryKey: queryKeys.sendgrid.trackingEvents() });
  },
  integrationSettings: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.integrationSettings.all });
  },
  eos: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.eos.all });
  },
  automation: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.automation.all });
    queryClient.invalidateQueries({ queryKey: ["automation", "workflows"] });
    queryClient.invalidateQueries({ queryKey: ["automation", "executions"] });
  },
  zohoDeal: (queryClient: any, dealId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.zoho.attachments(dealId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.zoho.engagements(dealId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.zoho.events(dealId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.zoho.contactEnrichment(dealId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.zoho.accountEnrichment(dealId) });
  },
};
