import { useAppConfig, AppConfig } from "./useAppConfig";

type FeatureKey = keyof AppConfig["features"];

/**
 * Hook to check feature flags from app_config
 * Features are cached globally with React Query (staleTime: 10 minutes)
 */
export function useFeatureFlags() {
  const { data: config, isLoading, error } = useAppConfig();

  /**
   * Check if a specific feature is enabled
   * @param featureName - The feature key (e.g., "enableAIChat", "enableMeetings")
   * @returns boolean indicating if the feature is enabled
   */
  const isFeatureEnabled = (featureName: FeatureKey): boolean => {
    // Four Spaces disabled — legacy Control Tower layout only
    if (featureName === "enableFourSpaces") {
      return false;
    }
    if (!config?.features) return true;
    return config.features[featureName] ?? true;
  };

  /**
   * Get all enabled features as an array of keys
   */
  const enabledFeatures = Object.entries(config?.features || {})
    .filter(([_, value]) => value === true)
    .map(([key]) => key as FeatureKey);

  /**
   * Get all disabled features as an array of keys
   */
  const disabledFeatures = Object.entries(config?.features || {})
    .filter(([_, value]) => value === false)
    .map(([key]) => key as FeatureKey);

  return {
    features: config?.features,
    isFeatureEnabled,
    enabledFeatures,
    disabledFeatures,
    isLoading,
    error,
  };
}
