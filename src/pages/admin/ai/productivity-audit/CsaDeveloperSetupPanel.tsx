import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Lightbulb,
  Copy,
  Download,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCsaIngestTokens,
  useCreateCsaIngestToken,
  useRevokeCsaIngestToken,
} from "@/hooks/useCsaReports";
import {
  buildDctCsaConfigJson,
  buildUserHooksJson,
  CSA_HOOK_REQUIREMENTS,
  getCsaTrackDownloadUrl,
  INSTALL_FILE_INSTRUCTIONS,
  USER_GLOBAL_PATHS,
} from "@/lib/csaUserGlobalSetup";

const CSA_REVEALED_TOKEN_KEY = "csa-setup-revealed-token";

function InstructionList({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1.5">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

function CopyBlock({
  title,
  instructions,
  content,
  filename,
}: {
  title: string;
  instructions: readonly string[];
  content: string;
  filename?: string;
}) {
  const copy = () => {
    navigator.clipboard.writeText(content);
    toast.success(`Copied ${filename || title}`);
  };

  const download = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <div className="mt-2">
          <InstructionList steps={instructions} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy className="h-3.5 w-3.5 mr-1" /> Copy file contents
        </Button>
        {filename && (
          <Button variant="default" size="sm" onClick={download}>
            <Download className="h-3.5 w-3.5 mr-1" /> Download {filename}
          </Button>
        )}
      </div>
      <pre className="text-xs bg-background border p-3 rounded-md overflow-x-auto max-h-48 whitespace-pre-wrap">
        {content}
      </pre>
    </div>
  );
}

function InstallStep({
  step,
  title,
  description,
  done,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border p-5 space-y-4 max-w-3xl">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {done ? <CheckCircle2 className="h-5 w-5" /> : step}
        </div>
        <div className="space-y-1 min-w-0 flex-1">
          <h3 className="font-semibold text-base">
            Step {step}: {title}
          </h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="pl-13 sm:pl-[3.25rem]">{children}</div>
    </div>
  );
}

function maskToken(token: string): string {
  if (token.length <= 12) return "••••••••••••";
  return `${"•".repeat(Math.min(24, token.length - 8))}${token.slice(-8)}`;
}

export function CsaDeveloperSetupPanel() {
  const [newTokenLabel, setNewTokenLabel] = useState("My Cursor");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const { data: tokensData, isLoading: tokensLoading } = useCsaIngestTokens();
  const createToken = useCreateCsaIngestToken();
  const revokeToken = useRevokeCsaIngestToken();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CSA_REVEALED_TOKEN_KEY);
      if (saved) setRevealedToken(saved);
    } catch {
      // ignore
    }
  }, []);

  const hooksJson = useMemo(() => buildUserHooksJson(), []);
  const configJson = useMemo(
    () =>
      revealedToken
        ? buildDctCsaConfigJson(revealedToken)
        : buildDctCsaConfigJson("csa_PASTE_YOUR_TOKEN_HERE"),
    [revealedToken],
  );
  const trackUrl = getCsaTrackDownloadUrl();
  const activeToken = (tokensData?.tokens || []).find((t) => !t.revoked_at);
  const hasActiveToken = !!activeToken;
  const hasStoredToken = !!revealedToken;
  const step1Complete = hasStoredToken || hasActiveToken;
  const canGenerateToken = !hasActiveToken;

  const handleCreateToken = async () => {
    if (hasActiveToken) {
      toast.error("Revoke your existing token first — only one active token is allowed.");
      return;
    }
    try {
      const result = await createToken.mutateAsync(newTokenLabel);
      setRevealedToken(result.token);
      setShowToken(true);
      try {
        localStorage.setItem(CSA_REVEALED_TOKEN_KEY, result.token);
      } catch {
        // ignore
      }
      toast.success("Token created — saved in this browser. Copy dct-csa.json below.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create token");
    }
  };

  const handleRevoke = async () => {
    if (!activeToken) return;
    try {
      await revokeToken.mutateAsync(activeToken.id);
      try {
        localStorage.removeItem(CSA_REVEALED_TOKEN_KEY);
      } catch {
        // ignore
      }
      setRevealedToken(null);
      setShowToken(false);
      toast.success("Token revoked — generate a new one below");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke token");
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Lightbulb className="h-4 w-4" />
        <AlertDescription>
          <strong>No project repo required.</strong> Install once in your Cursor user folder. Tracking
          works on <strong>any</strong> workspace. Follow each step in order.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <InstallStep
          step={1}
          title="Generate your ingest token (one per account)"
          description="Creates a single personal token. Your dct-csa.json below fills in automatically."
          done={step1Complete}
        >
          <div className="space-y-4">
            {hasActiveToken && !hasStoredToken && (
              <div className="rounded-md bg-muted border p-3 space-y-2">
                <p className="text-sm font-medium">You have an active token</p>
                <p className="text-sm text-muted-foreground">
                  The token value is not stored in this browser. Copy{" "}
                  <code className="text-xs">dct-csa.json</code> from another device, or revoke and
                  generate a new token.
                </p>
              </div>
            )}

            {hasActiveToken && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  Active token: <strong>{activeToken?.label}</strong>
                  {activeToken?.last_used_at && (
                    <span className="text-xs ml-1">
                      (last used {new Date(activeToken.last_used_at).toLocaleDateString()})
                    </span>
                  )}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevoke}
                  disabled={revokeToken.isPending || tokensLoading}
                >
                  Revoke token
                </Button>
              </div>
            )}

            {canGenerateToken && (
              <>
                <div className="space-y-2 max-w-sm">
                  <Label htmlFor="csa-token-label">Token label</Label>
                  <Input
                    id="csa-token-label"
                    value={newTokenLabel}
                    onChange={(e) => setNewTokenLabel(e.target.value)}
                    placeholder="My Cursor"
                  />
                </div>
                <Button onClick={handleCreateToken} disabled={createToken.isPending}>
                  {createToken.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Generate token
                </Button>
              </>
            )}

            {hasStoredToken && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Your ingest token</p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowToken((v) => !v)}
                      aria-label={showToken ? "Hide token" : "Show token"}
                    >
                      {showToken ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(revealedToken!);
                        toast.success("Token copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                    </Button>
                  </div>
                </div>
                <code className="text-xs break-all block text-muted-foreground">
                  {showToken ? revealedToken : maskToken(revealedToken!)}
                </code>
                <p className="text-xs text-muted-foreground">
                  Stored in this browser so you can view it anytime with the eye icon.
                </p>
              </div>
            )}

            <CopyBlock
              title={INSTALL_FILE_INSTRUCTIONS.dctCsa.title}
              instructions={INSTALL_FILE_INSTRUCTIONS.dctCsa.steps}
              content={configJson}
              filename="dct-csa.json"
            />
          </div>
        </InstallStep>

        <InstallStep
          step={2}
          title="Create the hooks folder"
          description="A subfolder inside your Cursor user directory where the tracker script lives."
        >
          <div className="space-y-3">
            <InstructionList steps={INSTALL_FILE_INSTRUCTIONS.hooksFolder.steps} />
          </div>
        </InstallStep>

        <InstallStep
          step={3}
          title="Download the hook script"
          description="Place this file inside the hooks folder from Step 2."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="default" size="sm">
              <a href={trackUrl} download="csa-track.mjs">
                <Download className="h-4 w-4 mr-2" />
                Download csa-track.mjs
              </a>
            </Button>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 mt-3">
            <li>
              <strong>Windows:</strong> {USER_GLOBAL_PATHS.win.trackScript}
            </li>
            <li>
              <strong>macOS / Linux:</strong> {USER_GLOBAL_PATHS.mac.trackScript}
            </li>
          </ul>
          <div className="rounded-md border bg-muted/40 p-3 mt-3 space-y-1">
            <p className="text-xs font-medium">Node.js requirements</p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              <li>
                Minimum Node.js {CSA_HOOK_REQUIREMENTS.minNode} (recommended{" "}
                {CSA_HOOK_REQUIREMENTS.recommendedNode}+)
              </li>
              {CSA_HOOK_REQUIREMENTS.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </InstallStep>

        <InstallStep
          step={4}
          title="Save hooks.json"
          description="Registers the tracker with Cursor — saved in the .cursor folder (not inside hooks/)."
        >
          <CopyBlock
            title={INSTALL_FILE_INSTRUCTIONS.hooksJson.title}
            instructions={INSTALL_FILE_INSTRUCTIONS.hooksJson.steps}
            content={hooksJson}
            filename="hooks.json"
          />
        </InstallStep>

        <InstallStep
          step={5}
          title="Restart Cursor"
          description="Fully quit Cursor (not just close the window), then open it again so the hooks load."
        >
          <p className="text-sm text-muted-foreground">
            On Windows, check the system tray and exit Cursor completely. Then reopen any project —
            tracking is global and works on every workspace.
          </p>
        </InstallStep>

        <InstallStep
          step={6}
          title="Use Cursor and regenerate your audit"
          description="After a normal day of Cursor usage, refresh your productivity report."
        >
          <p className="text-sm text-muted-foreground">
            Go to <strong>My Profile → Cursor Insights → My audit</strong> and click{" "}
            <strong>Regenerate my audit</strong>. Admins can also regenerate from the team dashboard.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Optional debug: set <code>"debug": true</code> in dct-csa.json, then check{" "}
            {USER_GLOBAL_PATHS.mac.log}
          </p>
        </InstallStep>
      </div>
    </div>
  );
}
