/**
 * Create Meeting Dialog
 *
 * Dialog form for creating a new meeting in meetings_v2 table.
 * Includes platform picker (Zoom, Microsoft Teams, Google Meet), then in-app meeting form.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Video, CheckCircle2, CalendarDays, ArrowLeft } from "lucide-react";
import { useCreateMeetingV2 } from "../../hooks/useMeetingsV2";
import DateTimePicker from "../common/DateTimePicker";
import type { MeetingType } from "../../types/meetings";
import { useIntegrationProvider, useOrganizationIntegration } from "@/hooks/useIntegrations";
import { usePrimaryByCategorySettings } from "@/hooks/useIntegrationSettings";
import { shouldShowProviderForCategory } from "@/lib/integration-preferences";
import { useUserOAuthToken, useHasValidToken, useConnectOAuth } from "@/hooks/useUserIntegrations";
import { useToast } from "@/hooks/use-toast";
import { initiateAzureLoginRedirect, getStoredGraphResponse, getStoredMSALResponse } from "@/lib/azureAuth";
import { validateMSALConfig } from "@/lib/msalConfig";
import { getTokenMetadata } from "@/lib/microsoftGraphClient";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type MeetingPlatformSlug = "zoom" | "microsoft-teams" | "google-meet";

/** True when the user has a valid Microsoft Graph token in sessionStorage (e.g. connected via Admin panel). */
function hasValidGraphTokenInSession(): boolean {
  if (typeof window === "undefined") return false;
  const g = getStoredGraphResponse();
  const m = getStoredMSALResponse();
  const token = g?.accessToken || m?.accessToken;
  if (!token?.trim()) return false;
  const meta = getTokenMetadata(token);
  return !!(meta && !meta.isExpired);
}

const PLATFORMS: {
  slug: MeetingPlatformSlug;
  label: string;
  connectLabel: string;
  providerSlug: string; // for OAuth/token (microsoft-teams and microsoft both valid for Teams)
  buttonClass: string;
}[] = [
  { slug: "zoom", label: "Zoom", connectLabel: "Connect", providerSlug: "zoom", buttonClass: "bg-[#2D8CFF] hover:bg-[#2D8CFF]/90" },
  { slug: "microsoft-teams", label: "Microsoft Teams", connectLabel: "Connect", providerSlug: "microsoft", buttonClass: "bg-[#5B5FC7] hover:bg-[#5B5FC7]/90" },
  { slug: "google-meet", label: "Google Meet", connectLabel: "Connect", providerSlug: "google-meet", buttonClass: "bg-[#EA4335] hover:bg-[#EA4335]/90" },
];

interface CreateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlatform?: (platform: MeetingPlatformSlug) => void;
}

function PlatformCard({
  platform,
  isOrgEnabled,
  isConnected,
  isConnecting,
  onConnect,
  onOpenChange,
  onSelectPlatform,
}: {
  platform: (typeof PLATFORMS)[number];
  isOrgEnabled: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: (providerSlug: string) => void;
  onOpenChange: (open: boolean) => void;
  onSelectPlatform?: (platform: MeetingPlatformSlug) => void;
}) {
  const handleCreateWith = () => {
    onSelectPlatform?.(platform.slug);
    onOpenChange(false);
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground p-4 flex flex-col gap-4 min-h-[120px] min-w-0"
      )}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <span className="font-medium break-words line-clamp-2">{platform.label}</span>
        {isConnected && (
          <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Connected
          </span>
        )}
      </div>
      <div className="mt-auto">
        {isConnected ? (
          <Button
            type="button"
            size="default"
            variant="default"
            className="w-full shrink-0 font-medium"
            onClick={handleCreateWith}
          >
            <Video className="mr-2 h-4 w-4 shrink-0" />
            <span>Create meeting</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className={cn("w-full text-white shrink-0", platform.buttonClass)}
            disabled={!isOrgEnabled || isConnecting}
            onClick={() => onConnect(platform.providerSlug)}
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Video className="mr-2 h-4 w-4 shrink-0" />
            )}
            <span className="truncate">{platform.connectLabel}</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export default function CreateMeetingDialog({
  open,
  onOpenChange,
  onSelectPlatform,
}: CreateMeetingDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMeeting = useCreateMeetingV2();
  const connectOAuth = useConnectOAuth();
  const [connectingMicrosoft, setConnectingMicrosoft] = useState(false);
  /** Which provider is currently connecting (Zoom/Google Meet redirect flow). So only that card shows loading. */
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [showInAppForm, setShowInAppForm] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<MeetingType>("internal");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
    now.setHours(now.getHours() + 1);
    now.setSeconds(0);
    now.setMilliseconds(0);
    return now.toISOString().slice(0, 16);
  });
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [location, setLocation] = useState("");
  const [notifyParticipants, setNotifyParticipants] = useState(false);

  const returnUrl = typeof window !== "undefined"
    ? `${window.location.origin}/meetings/schedule?openCreate=1`
    : "";

  const { data: zoomProvider } = useIntegrationProvider("zoom");
  const { data: teamsProvider } = useIntegrationProvider("microsoft-teams");
  const { data: googleMeetProvider } = useIntegrationProvider("google-meet");
  const { data: primaryByCategory } = usePrimaryByCategorySettings();
  const meetingPref = primaryByCategory?.["meeting-providers"];

  const visiblePlatforms = PLATFORMS.filter((platform) =>
    shouldShowProviderForCategory(platform.slug, meetingPref)
  );
  const hasMeetingProviderRestriction =
    Boolean(meetingPref?.single_active_only) ||
    Boolean(meetingPref?.active_slugs?.length);

  const zoomOrg = useOrganizationIntegration(zoomProvider?.id || "");
  const teamsOrg = useOrganizationIntegration(teamsProvider?.id || "");
  const googleMeetOrg = useOrganizationIntegration(googleMeetProvider?.id || "");

  const { data: zoomToken } = useUserOAuthToken("zoom");
  const { data: teamsTokenNew } = useUserOAuthToken("microsoft-teams");
  const { data: teamsTokenLegacy } = useUserOAuthToken("microsoft");
  const { data: googleMeetToken } = useUserOAuthToken("google-meet");

  const zoomValid = useHasValidToken("zoom");
  const teamsValidNew = useHasValidToken("microsoft-teams");
  const teamsValidLegacy = useHasValidToken("microsoft");
  const googleMeetValid = useHasValidToken("google-meet");

  const isZoomConnected = !!zoomToken && zoomValid.hasValidToken;
  const isTeamsConnected =
    (!!teamsTokenNew && teamsValidNew.hasValidToken) ||
    (!!teamsTokenLegacy && teamsValidLegacy.hasValidToken) ||
    hasValidGraphTokenInSession();
  const isGoogleMeetConnected = !!googleMeetToken && googleMeetValid.hasValidToken;

  const platformConnectionState = {
    zoom: { isOrgEnabled: !!zoomOrg.data?.integration?.enabled && zoomOrg.data?.integration?.connection_status === "connected", isConnected: isZoomConnected },
    "microsoft-teams": { isOrgEnabled: !!teamsOrg.data?.integration?.enabled && teamsOrg.data?.integration?.connection_status === "connected", isConnected: isTeamsConnected },
    "google-meet": { isOrgEnabled: !!googleMeetOrg.data?.integration?.enabled && googleMeetOrg.data?.integration?.connection_status === "connected", isConnected: isGoogleMeetConnected },
  };

  const handleConnect = async (providerSlug: string) => {
    // Microsoft: same in-place flow as admin (MSAL popup). Open popup synchronously on click to avoid popup blockers when opened from dialog.
    if (providerSlug === "microsoft" || providerSlug === "microsoft-teams") {
      const width = 500;
      const height = 700;
      const left = typeof window !== "undefined" ? window.screenX + (window.outerWidth - width) / 2 : 0;
      const top = typeof window !== "undefined" ? window.screenY + (window.outerHeight - height) / 2 : 0;
      const popup = typeof window !== "undefined"
        ? window.open("", "microsoft-auth", `width=${width},height=${height},left=${left},top=${top},popup=yes`)
        : null;
      if (typeof window !== "undefined" && (!popup || popup.closed)) {
        toast({
          title: "Popups blocked",
          description: "Please allow popups for this site to connect with Microsoft.",
          variant: "destructive",
        });
        return;
      }
      setConnectingMicrosoft(true);
      try {
        const configValidation = validateMSALConfig();
        if (!configValidation.valid) {
          if (popup && !popup.closed) popup.close();
          toast({
            title: "Microsoft sign-in not configured",
            description: configValidation.errors.join(". ") + " Configure in Admin or set VITE_MICROSOFT_CLIENT_ID.",
            variant: "destructive",
          });
          return;
        }
        const authResult = await initiateAzureLoginRedirect(popup ?? undefined);
        if (authResult?.accessToken) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            toast({
              title: "Session expired",
              description: "Please log in again and try connecting Microsoft.",
              variant: "destructive",
            });
            return;
          }
          const metadata = getTokenMetadata(authResult.accessToken);
          const expires_in = metadata
            ? Math.max(60, Math.round((metadata.expiresAt.getTime() - Date.now()) / 1000))
            : 3600;
          const { error: storeError } = await supabase.functions.invoke("user-oauth-store-token", {
            body: {
              provider: "microsoft-teams",
              access_token: authResult.accessToken,
              expires_in,
              account_email: authResult.account?.username ?? undefined,
              account_name: authResult.account?.name ?? undefined,
            },
          });
          if (storeError) {
            toast({
              title: "Connection failed",
              description: storeError.message || "Could not save Microsoft connection.",
              variant: "destructive",
            });
            return;
          }
          queryClient.invalidateQueries({ queryKey: ["user-oauth-tokens"] });
          queryClient.invalidateQueries({ queryKey: ["user-oauth-token"] });
          queryClient.invalidateQueries({ queryKey: ["available-user-providers"] });
          toast({
            title: "Connected",
            description: "Your Microsoft account is connected. You can create Teams meetings.",
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Microsoft sign-in failed.";
        const isCancelled = message === "Authentication window was closed";
        toast({
          title: isCancelled ? "Sign-in cancelled" : "Connection failed",
          description: isCancelled ? "You closed the sign-in window. Connect again when you're ready." : message,
          variant: isCancelled ? "default" : "destructive",
        });
      } finally {
        setConnectingMicrosoft(false);
      }
      return;
    }
    setConnectingProvider(providerSlug);
    connectOAuth.mutate(
      { provider: providerSlug, redirect_uri: returnUrl },
      { onSettled: () => setConnectingProvider(null) }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    try {
      await createMeeting.mutateAsync({
        title: title.trim(),
        meeting_type: type,
        description: description.trim() || undefined,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: parseInt(durationMinutes) || 60,
        location: location.trim() || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notify_participants: notifyParticipants,
      });

      setTitle("");
      setType("internal");
      setDescription("");
      setScheduledAt(() => {
        const now = new Date();
        now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
        now.setHours(now.getHours() + 1);
        now.setSeconds(0);
        now.setMilliseconds(0);
        return now.toISOString().slice(0, 16);
      });
      setDurationMinutes("60");
      setLocation("");
      setNotifyParticipants(false);

      onOpenChange(false);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setShowInAppForm(false); onOpenChange(next); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Meeting</DialogTitle>
        </DialogHeader>

        {!showInAppForm ? (
          <>
            {/* Step 1: Only platform picker */}
            <div className="space-y-3">
              <div>
                <Label className="text-base">Choose meeting platform</Label>
                {Object.values(platformConnectionState).some((s) => s.isConnected) && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Click <strong className="text-foreground">Create meeting</strong> on a connected platform to open the meeting form.
                  </p>
                )}
                {hasMeetingProviderRestriction && visiblePlatforms.length < PLATFORMS.length && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Your organization uses{" "}
                    <strong className="text-foreground">
                      {visiblePlatforms.map((p) => p.label).join(", ") || "selected providers"}
                    </strong>{" "}
                    for meetings. Change this in Admin → Integration Hub → Meeting Platforms.
                  </p>
                )}
              </div>
              {visiblePlatforms.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
                  No meeting platforms are active for your organization. Ask an admin to enable one
                  under Integration Hub → Meeting Platforms.
                </p>
              ) : (
              <div className={cn(
                "grid gap-4 min-w-0",
                visiblePlatforms.length === 1 ? "grid-cols-1 max-w-sm" : visiblePlatforms.length === 2 ? "grid-cols-2" : "grid-cols-3"
              )}>
                {visiblePlatforms.map((platform) => (
                  <PlatformCard
                    key={platform.slug}
                    platform={platform}
                    isOrgEnabled={platformConnectionState[platform.slug].isOrgEnabled}
                    isConnected={platformConnectionState[platform.slug].isConnected}
                    isConnecting={
                      platform.slug === "microsoft-teams"
                        ? connectingMicrosoft
                        : connectOAuth.isPending && connectingProvider === platform.providerSlug
                    }
                    onConnect={handleConnect}
                    onOpenChange={onOpenChange}
                    onSelectPlatform={onSelectPlatform}
                  />
                ))}
              </div>
              )}
            </div>
            <div className="pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowInAppForm(true)}
                className="flex items-center gap-2 w-full rounded-lg py-3 px-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>Create an in-app meeting (no video platform)</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowInAppForm(false)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to platform choice
            </Button>
            <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly Team Sync"
              required
              disabled={createMeeting.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as MeetingType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="l10">L10</SelectItem>
                <SelectItem value="one_on_one">One-on-One</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting agenda and notes..."
              rows={3}
              disabled={createMeeting.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Date & Time <span className="text-destructive">*</span>
            </Label>
            <DateTimePicker
              value={scheduledAt}
              onChange={setScheduledAt}
              timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
              disabled={createMeeting.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min="15"
              step="15"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="60"
              disabled={createMeeting.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Conference Room A / Zoom / Teams"
              disabled={createMeeting.isPending}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="notify"
              checked={notifyParticipants}
              onCheckedChange={(checked) => setNotifyParticipants(checked === true)}
              disabled={createMeeting.isPending}
            />
            <Label htmlFor="notify" className="font-normal cursor-pointer">
              Notify participants
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMeeting.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMeeting.isPending || !title.trim()}>
              {createMeeting.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Meeting
            </Button>
          </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
