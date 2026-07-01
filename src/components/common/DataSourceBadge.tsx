/**
 * DataSourceBadge - Shows where a record originated (HubSpot, Salesforce, manual, etc.)
 * Variants: inline (table rows), card (detail pages), minimal (icon only)
 */

import { ExternalLink, Database, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";

export type DataSourceProvider = "manual" | "hubspot" | "salesforce" | "zoho" | "pipedrive" | string;

interface DataSourceBadgeProps {
  dataSource?: string | null;
  lastSyncedAt?: string | null;
  externalUrl?: string | null;
  variant?: "inline" | "card" | "minimal";
  className?: string;
}

const PROVIDER_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  hubspot: { label: "HubSpot", color: "hsl(16, 100%, 50%)", icon: "🔗" },
  salesforce: { label: "Salesforce", color: "hsl(210, 100%, 56%)", icon: "☁️" },
  zoho: { label: "Zoho", color: "hsl(4, 90%, 58%)", icon: "📊" },
  pipedrive: { label: "Pipedrive", color: "hsl(145, 63%, 42%)", icon: "📈" },
  freshsales: { label: "Freshsales", color: "hsl(199, 89%, 48%)", icon: "🔵" },
  manual: { label: "Manual", color: "hsl(var(--muted-foreground))", icon: "" },
};

function getProviderConfig(source: string) {
  return PROVIDER_CONFIG[source] ?? { label: source, color: "hsl(var(--muted-foreground))", icon: "🔗" };
}

export function DataSourceBadge({
  dataSource,
  externalUrl,
  lastSyncedAt,
  variant = "inline",
  className = "",
}: DataSourceBadgeProps) {
  const normalizedSource = (dataSource || "manual").toLowerCase();

  // minimal: return null for manual/null records
  if (normalizedSource === "manual" && variant === "minimal") return null;

  const config = getProviderConfig(normalizedSource);
  const syncTimeAgo = lastSyncedAt
    ? formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })
    : null;
  const syncFullDate = lastSyncedAt
    ? format(new Date(lastSyncedAt), "MMM d, yyyy 'at' h:mm a")
    : null;

  if (variant === "minimal") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`text-xs cursor-default ${className}`}>{config.icon}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              From {config.label}
              {syncTimeAgo && ` · Synced ${syncTimeAgo}`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === "card") {
    if (normalizedSource === "manual") {
      return (
        <div className={`flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 ${className}`}>
          <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Created in Control Tower</p>
            {syncFullDate && (
              <p className="text-xs text-muted-foreground">on {syncFullDate}</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={`flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 ${className}`}>
        <span className="text-lg flex-shrink-0">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">From {config.label}</p>
          {syncFullDate && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <RefreshCw className="h-3 w-3" />
              Last synced: {syncFullDate}
            </p>
          )}
          <p className="text-xs text-muted-foreground italic mt-1">
            This record is synced from {config.label}. Edits here will not push back.
          </p>
        </div>
        {externalUrl && (
          <Button
            variant="default"
            size="sm"
            className="flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              window.open(externalUrl, "_blank", "noopener,noreferrer");
            }}
          >
            View in {config.label}
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    );
  }

  // inline variant (for table rows)
  if (normalizedSource === "manual") {
    return (
      <span className={`text-xs text-muted-foreground ${className}`}>
        Created manually
      </span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`gap-1 text-xs font-normal ${externalUrl ? "cursor-pointer" : "cursor-default"} ${className}`}
            style={{ borderColor: config.color, color: config.color }}
            onClick={(e) => {
              if (externalUrl) {
                e.stopPropagation();
                window.open(externalUrl, "_blank", "noopener,noreferrer");
              }
            }}
          >
            <span>{config.icon}</span>
            From {config.label}
            {syncTimeAgo && ` · Synced ${syncTimeAgo}`}
            {externalUrl && <ExternalLink className="h-2.5 w-2.5 ml-0.5" />}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>From {config.label}</p>
          {syncTimeAgo && <p className="text-xs">Synced {syncTimeAgo}</p>}
          {externalUrl && <p className="text-xs">Click to open in {config.label}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
