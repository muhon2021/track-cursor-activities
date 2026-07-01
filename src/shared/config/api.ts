/**
 * API Endpoint Registry
 *
 * Centralized definition of all Supabase Edge Function endpoints.
 * Modules reference endpoints from here instead of hardcoding strings.
 */

export const API = {
  // Auth
  AUTH: {
    AZURE_LOGIN: "azure-auth-login",
    AZURE_LOGOUT: "azure-auth-logout",
    PROMOTE_ADMIN: "promote-to-admin",
    PROMOTE_FIRST_ADMIN: "promote-first-admin",
    VALIDATE_SSO: "validate-sso-domain",
  },

  // AI
  AI: {
    CHAT: "ai-chat-assistant",
    AGENT_RUN: "run-ai-agent",
    AGENT_CHAT_STREAM: "agent-chat-stream",
    AGENT_CONVERSATION: "agent-conversation-chat",
    SYNC_MODELS: "sync-ai-models",
    GENERATE_EMBEDDINGS: "generate-embeddings",
    SEMANTIC_SEARCH: "semantic-search",
    UNIFIED_SEARCH: "unified-knowledge-search",
    EXTRACT_MEMORIES: "extract-agent-memories",
  },

  // Knowledge
  KNOWLEDGE: {
    AUTO_EMBED: "auto-embed-knowledge-entry",
    AUTO_EMBED_FILES: "auto-embed-knowledge-files",
    SEARCH: "unified-knowledge-search",
    USER_UPLOAD: "user-knowledge-upload",
    USER_PROCESS: "user-knowledge-process",
    USER_DRIVE_SYNC: "user-knowledge-drive-sync",
  },

  // Meetings
  MEETINGS: {
    BASE: "api-v1-meetings",
    SUMMARY: "generate-meeting-summary",
    CATEGORIZE: "categorize-meeting",
    AUTO_EMBED: "auto-embed-meetings",
    TRANSCRIPT_PROCESS: "zoom-transcript-processing",
  },

  // Integrations
  INTEGRATIONS: {
    OAUTH_EXCHANGE: "oauth-exchange-token",
    OAUTH_REFRESH: "oauth-refresh-token",
    OAUTH_CONNECT: "user-oauth-connect",
    OAUTH_CALLBACK: "user-oauth-callback",
    OAUTH_DISCONNECT: "user-oauth-disconnect",
    GOOGLE_DRIVE_SYNC: "google-drive-sync",
    GOOGLE_DRIVE_UPLOAD: "google-drive-upload",
    ZOOM_SYNC: "sync-zoom-files",
    MS_GRAPH_SUBSCRIBE: "microsoft-graph-subscribe",
    CHECK_ENV: "check-environment",
    WEBHOOK: "webhook-handler",
  },

  // Notifications
  NOTIFICATIONS: {
    SEND: "send-notification",
    ROUTER: "notification-router",
    DIGEST: "notification-digest",
    SEND_EMAIL: "send-email",
    SEND_FEEDBACK: "send-feedback-notification",
  },

  // MCP
  MCP: {
    EXECUTE_TOOL: "execute-mcp-tool",
    VERIFY_SERVER: "verify-mcp-server",
  },

  // Graphify
  GRAPHIFY: {
    QUERY: "graphify-query",
    BACKFILL: "graphify-backfill",
    SYNC_RELATIONSHIPS: "graphify-sync-relationships",
    EXTRACT_ENTITIES: "graphify-extract-entities",
  },

  // System
  SYSTEM: {
    SEED_TEMPLATES: "seed-template-data",
    VALIDATE_API_KEY: "validate-api-key",
    AUDIT_LOG: "audit-log-writer",
    GENERATE_DOC: "generate-business-doc",
  },

  // CRM (Zoho)
  CRM: {
    ZOHO_SYNC: "zoho-crm-sync",
    ZOHO_DEAL_ATTACHMENTS_SYNC: "zoho-deal-attachments-sync",
    ZOHO_DEAL_ENGAGEMENTS_SYNC: "zoho-deal-engagements-sync",
    ZOHO_DEAL_EVENTS_SYNC: "zoho-deal-events-sync",
    ZOHO_DEAL_CONTACT_ENRICHMENT_SYNC: "zoho-deal-contact-enrichment-sync",
    ZOHO_DEAL_ACCOUNT_ENRICHMENT_SYNC: "zoho-deal-account-enrichment-sync",
  },

  // Clients (current)
  CLIENTS: {
    BASE: "api-v1-clients",
  },

  // Productivity (Path B)
  PRODUCTIVITY: {
    TEAM_METRICS: "team-productivity-metrics",
    TEAM_LIST: "team-productivity-list",
  },

  // Automation
  AUTOMATION: {
    MANAGE: "automation-manage",
    TRIGGER_EVALUATOR: "automation-trigger-evaluator",
    EXECUTOR: "automation-executor",
    SCHEDULER: "automation-scheduler",
    WEBHOOK_RECEIVER: "automation-webhook-receiver",
  },
} as const;
