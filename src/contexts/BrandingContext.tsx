import { createContext, useContext, useEffect, ReactNode } from "react";
import { useAppConfig } from "@/hooks/useAppConfig";

export interface BrandingContextType {
  companyName: string;
  tagline: string;
  supportEmail: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor?: string;
  emailFromName?: string;
  replyToEmail?: string;
  loginMessage?: string;
  loginBackgroundUrl?: string;
  isLoading: boolean;
}

const DEFAULT_BRANDING: BrandingContextType = {
  companyName: "Control Tower",
  tagline: "AI-Powered Collaboration Platform",
  supportEmail: "support@control-tower.app",
  primaryColor: "#6366f1",
  loginMessage: "Welcome to Control Tower",
  isLoading: false,
};

// Use a stable singleton across HMR reloads to prevent duplicate context
// instances when Vite Fast Refresh re-evaluates this module.
const globalKey = "__ct_branding_context__";
const g = globalThis as unknown as Record<string, React.Context<BrandingContextType>>;
const BrandingContext: React.Context<BrandingContextType> =
  g[globalKey] ?? createContext<BrandingContextType>(DEFAULT_BRANDING);
g[globalKey] = BrandingContext;

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { data: config, isLoading } = useAppConfig();

  const primaryColor = config?.branding?.primaryColor || DEFAULT_BRANDING.primaryColor;

  useEffect(() => {
    document.documentElement.style.setProperty("--brand-primary", primaryColor);
  }, [primaryColor]);

  const value: BrandingContextType = {
    companyName: config?.branding?.companyName || DEFAULT_BRANDING.companyName,
    tagline: config?.branding?.tagline || DEFAULT_BRANDING.tagline,
    supportEmail: config?.branding?.supportEmail || DEFAULT_BRANDING.supportEmail,
    logoUrl: config?.branding?.logoUrl || undefined,
    faviconUrl: config?.branding?.faviconUrl || undefined,
    primaryColor,
    secondaryColor: config?.branding?.secondaryColor || undefined,
    emailFromName: config?.branding?.emailFromName || undefined,
    replyToEmail: config?.branding?.replyToEmail || undefined,
    loginMessage: config?.branding?.loginMessage || DEFAULT_BRANDING.loginMessage,
    loginBackgroundUrl: config?.branding?.loginBackgroundUrl || undefined,
    isLoading,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
