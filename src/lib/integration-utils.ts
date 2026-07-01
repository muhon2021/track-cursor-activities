/**
 * Integration Hub Utilities
 * Helper functions for the integration system
 */

import {
  Brain,
  Sparkles,
  Cloud,
  Zap,
  Layers,
  Video,
  Mic2,
  Mail,
  Users,
  Kanban,
  Shield,
  CheckCircle2,
  Circle,
  XCircle,
  Clock,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type AuthType = 'api_key' | 'oauth2' | 'basic' | 'service_account';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'testing';
export type IntegrationStatus = 'success' | 'error' | 'partial';

export interface IntegrationCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  display_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface OAuthConfig {
  authorize_url?: string;
  token_url?: string;
  scopes?: string[];
  client_id?: string;
  client_secret?: string;
  response_type?: string;
  grant_type?: string;
}

export interface IntegrationProvider {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  docs_url: string | null;
  auth_type: string;
  oauth_config: OAuthConfig | Record<string, any> | null;
  is_available: boolean | null;
  is_coming_soon: boolean | null;
  is_beta: boolean | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationField {
  id: string;
  provider_id: string;
  field_key: string;
  label: string;
  field_type: string;
  placeholder: string | null;
  default_value: string | null;
  is_required: boolean | null;
  is_sensitive: boolean | null;
  help_text: string | null;
  validation_regex: string | null;
  select_options: any | null;
  display_order: number | null;
  created_at: string;
}

export interface OrganizationIntegration {
  id: string;
  user_id: string;
  provider_id: string;
  enabled: boolean | null;
  config: Record<string, any> | null;
  connection_status: string | null;
  connection_message: string | null;
  last_tested_at: string | null;
  last_sync_at: string | null;
  oauth_tokens: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationService {
  id: string;
  provider_id: string;
  name: string;
  service_key: string;
  description: string | null;
  features: Record<string, any> | null;
  has_cost: boolean | null;
  cost_model: Record<string, any> | null;
  enabled: boolean | null;
  is_default: boolean | null;
  is_beta: boolean | null;
  requires_config: boolean | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationUsageLog {
  id: string;
  provider_id: string | null;
  service_id: string | null;
  user_id: string | null;
  action: string;
  status: string;
  request_metadata: Record<string, any> | null;
  response_metadata: Record<string, any> | null;
  error_message: string | null;
  estimated_cost: number | null;
  created_at: string;
}

// ============================================
// ICON MAPPING
// ============================================

/**
 * Map category slug to Lucide icon
 */
export function getCategoryIcon(iconName: string): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    Brain,
    Video,
    Mail,
    Users,
    Kanban,
    Cloud,
    Shield,
    Sparkles,
    Zap,
  };

  return iconMap[iconName] || Cloud;
}

/**
 * Map provider slug to Lucide icon
 */
export function getProviderIcon(slug: string): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    // AI Providers
    openai: Brain,
    anthropic: Sparkles,
    'google-gemini': Cloud,
    perplexity: Zap,
    openrouter: Layers,

    // Meeting Providers
    zoom: Video,
    fellow: Mic2,
    'microsoft-teams': Users,
    'google-meet': Video,
    webex: Video,
    gotomeeting: Video,

    // Email Providers
    outlook: Mail,
    sendgrid: Mail,
    mailgun: Mail,
    postmark: Mail,
    'amazon-ses': Cloud,
    resend: Mail,

    // CRM Systems
    salesforce: Users,
    hubspot: Users,
    pipedrive: Users,
    'zoho-crm': Users,

    // Project Management
    jira: Kanban,
    asana: Kanban,
    monday: Kanban,
    trello: Kanban,
    clickup: Kanban,
    activecollab: Kanban,
    float: Kanban,

    // Storage & Productivity
    'google-workspace': Cloud,
    'microsoft-365': Cloud,
    sharepoint: Cloud,
    confluence: Cloud,

    // Authentication
    'google-login': Shield,
    auth0: Shield,
    okta: Shield,
  };

  return iconMap[slug] || Cloud;
}

/**
 * Get connection status icon
 */
export function getConnectionStatusIcon(status: string | null): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    connected: CheckCircle2,
    disconnected: Circle,
    error: XCircle,
    testing: Clock,
  };

  return iconMap[status || 'disconnected'] || Circle;
}

// ============================================
// STATUS HELPERS
// ============================================

/**
 * Get badge variant for connection status
 */
export function getConnectionStatusVariant(
  status: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    connected: 'default',
    disconnected: 'secondary',
    error: 'destructive',
    testing: 'outline',
  };

  return variantMap[status || 'disconnected'] || 'secondary';
}

/**
 * Get human-readable connection status label
 */
export function getConnectionStatusLabel(status: string | null): string {
  const labelMap: Record<string, string> = {
    connected: 'Connected',
    disconnected: 'Not Connected',
    error: 'Error',
    testing: 'Testing...',
  };

  return labelMap[status || 'disconnected'] || 'Unknown';
}

/**
 * Get auth type label
 */
export function getAuthTypeLabel(authType: string): string {
  const labelMap: Record<string, string> = {
    api_key: 'API Key',
    oauth2: 'OAuth 2.0',
    basic: 'Basic Auth',
    service_account: 'Service Account',
  };

  return labelMap[authType] || authType;
}

/**
 * Get action button label for provider card
 */
export function getProviderActionLabel(
  provider: IntegrationProvider,
  orgIntegration?: OrganizationIntegration
): string {
  if (provider.is_coming_soon) {
    return 'Coming Soon';
  }

  if (orgIntegration?.connection_status === 'connected') {
    return 'Configure';
  }

  if (provider.auth_type === 'oauth2') {
    return 'Connect';
  }

  return 'Configure';
}

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

  return date.toLocaleDateString();
}

/**
 * Format cost (e.g., "$0.0042")
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Mask sensitive values (e.g., API keys)
 */
export const CONFIGURED_CREDENTIAL_PLACEHOLDER = '__CONFIGURED__';

export function maskSensitiveValue(value: string): string {
  if (!value || value === CONFIGURED_CREDENTIAL_PLACEHOLDER) {
    return '••••••••';
  }
  if (value.length < 8) {
    return '••••••••';
  }

  const visibleChars = 4;
  const lastChars = value.slice(-visibleChars);
  return `${'•'.repeat(value.length - visibleChars)}${lastChars}`;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate field value based on field type and validation rules
 */
export function validateFieldValue(
  field: IntegrationField,
  value: string
): { valid: boolean; error?: string } {
  // Check if required
  if (field.is_required && !value) {
    return { valid: false, error: `${field.label} is required` };
  }

  // Skip validation if empty and not required
  if (!value) {
    return { valid: true };
  }

  // Email validation
  if (field.field_type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { valid: false, error: 'Invalid email address' };
    }
  }

  // URL validation
  if (field.field_type === 'url') {
    try {
      new URL(value);
    } catch {
      return { valid: false, error: 'Invalid URL' };
    }
  }

  // Custom regex validation
  if (field.validation_regex) {
    const regex = new RegExp(field.validation_regex);
    if (!regex.test(value)) {
      return { valid: false, error: 'Invalid format' };
    }
  }

  return { valid: true };
}

/**
 * Check if all required fields are filled
 */
export function areRequiredFieldsFilled(
  fields: IntegrationField[],
  config: Record<string, any>,
  configuredSensitiveFields: string[] = [],
): boolean {
  const configured = new Set(configuredSensitiveFields);
  return fields
    .filter((field) => field.is_required)
    .every((field) => {
      const value = config[field.field_key];
      if (value && String(value).trim()) return true;
      return configured.has(field.field_key);
    });
}

// ============================================
// CONFIG HELPERS
// ============================================

/**
 * Build OAuth authorization URL
 */
export function buildOAuthAuthorizationUrl(
  provider: IntegrationProvider,
  state: string,
  redirectUri: string,
  credentials?: Record<string, string>
): string {
  if (!provider.oauth_config) {
    throw new Error('Provider does not have OAuth configuration');
  }

  const oauth = provider.oauth_config as OAuthConfig & { scopes?: string[] };
  const scopesArr = Array.isArray(oauth.scopes) ? oauth.scopes : [];
  const clientId =
    (credentials?.zoho_client_id && credentials.zoho_client_id.trim()) ||
    (credentials?.client_id && credentials.client_id.trim()) ||
    oauth.client_id ||
    '';

  if (!clientId) {
    throw new Error(
      'Client ID is missing. Enter and save your Zoho Client ID (or client ID) in Configuration first.'
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: oauth.response_type || 'code',
    state,
    scope: scopesArr.join(' '),
  });

  const authorizeUrl = oauth.authorize_url;
  if (!authorizeUrl) {
    throw new Error('Provider is missing authorize_url in OAuth configuration');
  }

  return `${authorizeUrl}?${params.toString()}`;
}

/**
 * Generate random state for OAuth CSRF protection
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store OAuth state in localStorage for CSRF validation
 */
export function storeOAuthState(state: string, providerId: string): void {
  const stateData = {
    state,
    providerId,
    timestamp: Date.now(),
  };
  localStorage.setItem(`oauth_state_${state}`, JSON.stringify(stateData));
}

/**
 * Retrieve and validate OAuth state from localStorage
 */
export function retrieveOAuthState(state: string): { providerId: string } | null {
  const key = `oauth_state_${state}`;
  const stored = localStorage.getItem(key);

  if (!stored) return null;

  try {
    const stateData = JSON.parse(stored);

    // Check if state is expired (5 minutes)
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - stateData.timestamp > fiveMinutes) {
      localStorage.removeItem(key);
      return null;
    }

    // Remove state after retrieval (one-time use)
    localStorage.removeItem(key);

    return { providerId: stateData.providerId };
  } catch {
    return null;
  }
}

/**
 * Clear expired OAuth states from localStorage
 */
export function clearExpiredOAuthStates(): void {
  const fiveMinutes = 5 * 60 * 1000;
  const keys = Object.keys(localStorage);

  keys.forEach((key) => {
    if (key.startsWith('oauth_state_')) {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const stateData = JSON.parse(stored);
          if (Date.now() - stateData.timestamp > fiveMinutes) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    }
  });
}

/**
 * Extract sensitive field keys from fields array
 */
export function getSensitiveFieldKeys(fields: IntegrationField[]): string[] {
  return fields.filter((field) => field.is_sensitive).map((field) => field.field_key);
}

// ============================================
// PROVIDER HELPERS
// ============================================

/**
 * Check if provider requires OAuth
 */
export function requiresOAuth(provider: IntegrationProvider): boolean {
  return provider.auth_type === 'oauth2';
}

/**
 * Check if provider is configured
 */
export function isProviderConfigured(orgIntegration?: OrganizationIntegration): boolean {
  if (!orgIntegration) return false;
  return Object.keys(orgIntegration.config).length > 0;
}

/**
 * Get provider status for display
 */
export function getProviderStatus(
  provider: IntegrationProvider,
  orgIntegration?: OrganizationIntegration
): 'connected' | 'configured' | 'available' | 'coming_soon' {
  if (provider.is_coming_soon) return 'coming_soon';
  if (!orgIntegration) return 'available';
  if (orgIntegration.connection_status === 'connected') return 'connected';
  if (isProviderConfigured(orgIntegration)) return 'configured';
  return 'available';
}

// ============================================
// SORTING & FILTERING
// ============================================

/**
 * Sort providers by display order
 */
export function sortProvidersByOrder<T extends { display_order: number }>(providers: T[]): T[] {
  return [...providers].sort((a, b) => a.display_order - b.display_order);
}

/**
 * Sort categories by display order
 */
export function sortCategoriesByOrder<T extends { display_order: number }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => a.display_order - b.display_order);
}

/**
 * Filter providers by search query
 */
export function filterProvidersByQuery(
  providers: IntegrationProvider[],
  query: string
): IntegrationProvider[] {
  if (!query) return providers;

  const lowerQuery = query.toLowerCase();
  return providers.filter((provider) => {
    const desc = (provider.description ?? '').toLowerCase();
    return (
      provider.name.toLowerCase().includes(lowerQuery) ||
      desc.includes(lowerQuery) ||
      provider.slug.toLowerCase().includes(lowerQuery)
    );
  });
}

// ============================================
// CATEGORY HELPERS
// ============================================

/** Match AI Providers tab regardless of slug variant in DB */
export function isAIProvidersCategory(slug: string, name?: string): boolean {
  const normalized = slug.toLowerCase().replace(/_/g, '-').trim();
  if (normalized === 'ai-providers' || normalized === 'ai-provider') return true;
  if (normalized.includes('ai') && normalized.includes('provider')) return true;
  const normalizedName = name?.trim().toLowerCase();
  if (normalizedName === 'ai providers' || normalizedName === 'ai provider') return true;
  return false;
}

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}
