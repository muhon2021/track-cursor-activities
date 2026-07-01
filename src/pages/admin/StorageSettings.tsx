import { useEffect, useState } from "react";
import {
  AlertCircle,
  Cloud,
  Database,
  HardDrive,
  Loader2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StorageMetricsDisplay } from "@/components/admin/StorageMetricsDisplay";
import {
  useRefreshStorageMetrics,
  useStorageSettings,
  useTestS3Connection,
  useTestSupabaseConnection,
  useUpdateStorageSettings,
} from "@/hooks/useStorageSettings";
import type { StorageProvider } from "@/types/storage";

interface S3FormState {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
}

interface SupabaseFormState {
  bucketName: string;
  isPublic: boolean;
}

const EMPTY_S3_FORM: S3FormState = {
  accessKeyId: "",
  secretAccessKey: "",
  region: "us-east-1",
  bucketName: "",
};

const EMPTY_SUPABASE_FORM: SupabaseFormState = {
  bucketName: "knowledgebase",
  isPublic: true,
};

const PROVIDER_LABELS: Record<StorageProvider, string> = {
  local: "Root Directory",
  s3: "AWS S3 Bucket",
  supabase: "Supabase Storage",
};

export default function StorageSettings(): JSX.Element {
  const { data: settings, isLoading, isError, error } = useStorageSettings();
  const updateSettings = useUpdateStorageSettings();
  const testS3 = useTestS3Connection();
  const testSupabase = useTestSupabaseConnection();
  const refreshMetrics = useRefreshStorageMetrics();

  const [activeProvider, setActiveProvider] = useState<StorageProvider>("local");
  const [pendingProvider, setPendingProvider] = useState<StorageProvider | null>(null);
  const [isS3Editing, setIsS3Editing] = useState(false);
  const [isSupabaseEditing, setIsSupabaseEditing] = useState(false);
  const [s3TestPassed, setS3TestPassed] = useState(false);
  const [supabaseTestPassed, setSupabaseTestPassed] = useState(false);
  const [s3Form, setS3Form] = useState<S3FormState>(EMPTY_S3_FORM);
  const [supabaseForm, setSupabaseForm] = useState<SupabaseFormState>(EMPTY_SUPABASE_FORM);

  useEffect(() => {
    if (!settings) {
      return;
    }

    setActiveProvider(settings.storageType);
    setS3Form({
      accessKeyId: "",
      secretAccessKey: "",
      region: settings.s3.region || "us-east-1",
      bucketName: "",
    });
    setSupabaseForm({
      bucketName: settings.supabase.bucketName || "knowledgebase",
      isPublic: settings.supabase.isPublic,
    });
  }, [settings]);

  const handleProviderToggle = (provider: StorageProvider, enabled: boolean): void => {
    if (!enabled || provider === activeProvider) {
      return;
    }

    setPendingProvider(provider);
  };

  const confirmProviderSwitch = async (): Promise<void> => {
    if (!pendingProvider) {
      return;
    }

    await updateSettings.mutateAsync({ storageType: pendingProvider });
    setActiveProvider(pendingProvider);
    setPendingProvider(null);
  };

  const handleS3Test = async (): Promise<void> => {
    await testS3.mutateAsync({
      provider: "s3",
      accessKeyId: s3Form.accessKeyId || undefined,
      secretAccessKey: s3Form.secretAccessKey || undefined,
      region: s3Form.region || undefined,
      bucketName: s3Form.bucketName || undefined,
    });
    setS3TestPassed(true);
  };

  const handleS3Save = async (): Promise<void> => {
    if (!s3TestPassed) {
      return;
    }

    await updateSettings.mutateAsync({
      accessKeyId: s3Form.accessKeyId || undefined,
      secretAccessKey: s3Form.secretAccessKey || undefined,
      region: s3Form.region || undefined,
      bucketName: s3Form.bucketName || undefined,
    });

    setIsS3Editing(false);
    setS3TestPassed(false);
    setS3Form((current) => ({ ...current, accessKeyId: "", secretAccessKey: "", bucketName: "" }));
  };

  const handleSupabaseTest = async (): Promise<void> => {
    await testSupabase.mutateAsync({
      provider: "supabase",
      supabaseBucketName: supabaseForm.bucketName || undefined,
      supabaseStoragePublic: supabaseForm.isPublic,
    });
    setSupabaseTestPassed(true);
  };

  const handleSupabaseSave = async (): Promise<void> => {
    if (!supabaseTestPassed) {
      return;
    }

    await updateSettings.mutateAsync({
      supabaseBucketName: supabaseForm.bucketName,
      supabaseStoragePublic: supabaseForm.isPublic,
    });

    setIsSupabaseEditing(false);
    setSupabaseTestPassed(false);
  };

  if (isError) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Storage Configuration</h1>
          <p className="text-muted-foreground">
            Choose between Root Directory, AWS S3, or Supabase for file storage.
          </p>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load storage settings."}
        </div>
      </div>
    );
  }

  if (isLoading || !settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isProcessing =
    updateSettings.isPending ||
    testS3.isPending ||
    testSupabase.isPending ||
    refreshMetrics.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Storage Configuration</h1>
        <p className="text-muted-foreground">
          Choose between Root Directory, AWS S3, or Supabase for file storage.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <HardDrive className="mt-1 h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Root Directory</CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                Files are stored in the application&apos;s default local storage bucket. This is the
                default option and requires no additional configuration.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {activeProvider === "local" ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={activeProvider === "local"}
              onCheckedChange={(checked) => handleProviderToggle("local", checked)}
              disabled={isProcessing}
            />
          </div>
        </CardHeader>
        <CardContent>
          {activeProvider === "local" && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Root Directory storage is currently active.
            </div>
          )}
          <StorageMetricsDisplay
            metrics={settings.metrics.root}
            providerLabel="Local"
            onRefresh={() => refreshMetrics.mutate()}
            isRefreshing={refreshMetrics.isPending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Cloud className="mt-1 h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>AWS S3 Bucket</CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                Files are stored on Amazon S3. AWS credentials and bucket configuration are required.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {activeProvider === "s3" ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={activeProvider === "s3"}
              onCheckedChange={(checked) => handleProviderToggle("s3", checked)}
              disabled={isProcessing}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {activeProvider === "s3" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              AWS S3 storage is currently active.
            </div>
          )}

          <StorageMetricsDisplay
            metrics={settings.metrics.s3}
            providerLabel="AWS S3"
            onRefresh={() => refreshMetrics.mutate()}
            isRefreshing={refreshMetrics.isPending}
          />

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">AWS Configuration</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsS3Editing((current) => !current);
                  setS3TestPassed(false);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {isS3Editing ? "Cancel" : "Edit"}
              </Button>
            </div>

            {isS3Editing ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="accessKeyId">Access Key ID</Label>
                  <Input
                    id="accessKeyId"
                    placeholder={settings.s3.accessKeyIdMasked || "AKIA..."}
                    value={s3Form.accessKeyId}
                    onChange={(event) => {
                      setS3TestPassed(false);
                      setS3Form((current) => ({ ...current, accessKeyId: event.target.value }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                  <Input
                    id="secretAccessKey"
                    type="password"
                    placeholder={settings.s3.secretAccessKeyMasked || "Enter secret access key"}
                    value={s3Form.secretAccessKey}
                    onChange={(event) => {
                      setS3TestPassed(false);
                      setS3Form((current) => ({ ...current, secretAccessKey: event.target.value }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Input
                    id="region"
                    placeholder="us-east-1"
                    value={s3Form.region}
                    onChange={(event) => {
                      setS3TestPassed(false);
                      setS3Form((current) => ({ ...current, region: event.target.value }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bucketName">S3 Bucket Name</Label>
                  <Input
                    id="bucketName"
                    placeholder={settings.s3.bucketNameMasked || "my-bucket"}
                    value={s3Form.bucketName}
                    onChange={(event) => {
                      setS3TestPassed(false);
                      setS3Form((current) => ({ ...current, bucketName: event.target.value }));
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleS3Test}
                    disabled={testS3.isPending}
                  >
                    {testS3.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Test Connection
                  </Button>
                  <Button
                    type="button"
                    onClick={handleS3Save}
                    disabled={!s3TestPassed || updateSettings.isPending}
                  >
                    Save Configuration
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Access Key ID</Label>
                  <Input readOnly value={settings.s3.accessKeyIdMasked || "Not configured"} />
                </div>
                <div className="space-y-2">
                  <Label>Secret Access Key</Label>
                  <Input
                    readOnly
                    value={settings.s3.secretAccessKeySet ? settings.s3.secretAccessKeyMasked : "Not configured"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Input readOnly value={settings.s3.region} />
                </div>
                <div className="space-y-2">
                  <Label>S3 Bucket Name</Label>
                  <Input readOnly value={settings.s3.bucketNameMasked || "Not configured"} />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Database className="mt-1 h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Supabase Storage</CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                Files are stored in a Supabase Storage bucket. Configure the bucket name and visibility.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {activeProvider === "supabase" ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={activeProvider === "supabase"}
              onCheckedChange={(checked) => handleProviderToggle("supabase", checked)}
              disabled={isProcessing}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {activeProvider === "supabase" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Supabase storage is currently active.
            </div>
          )}

          <StorageMetricsDisplay
            metrics={settings.metrics.supabase}
            providerLabel="Supabase"
            onRefresh={() => refreshMetrics.mutate()}
            isRefreshing={refreshMetrics.isPending}
          />

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Supabase Configuration</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSupabaseEditing((current) => !current);
                  setSupabaseTestPassed(false);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {isSupabaseEditing ? "Cancel" : "Edit"}
              </Button>
            </div>

            {isSupabaseEditing ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="supabaseBucket">Supabase Bucket Name</Label>
                  <Input
                    id="supabaseBucket"
                    value={supabaseForm.bucketName}
                    onChange={(event) => {
                      setSupabaseTestPassed(false);
                      setSupabaseForm((current) => ({ ...current, bucketName: event.target.value }));
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <Label htmlFor="supabasePublic">Public bucket</Label>
                    <p className="text-sm text-muted-foreground">Use public URLs instead of signed URLs</p>
                  </div>
                  <Switch
                    id="supabasePublic"
                    checked={supabaseForm.isPublic}
                    onCheckedChange={(checked) => {
                      setSupabaseTestPassed(false);
                      setSupabaseForm((current) => ({ ...current, isPublic: checked }));
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSupabaseTest}
                    disabled={testSupabase.isPending}
                  >
                    {testSupabase.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Test Connection
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSupabaseSave}
                    disabled={!supabaseTestPassed || updateSettings.isPending}
                  >
                    Save Configuration
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Supabase Bucket Name</Label>
                  <Input readOnly value={settings.supabase.bucketName} />
                </div>
                <div className="space-y-2">
                  <Label>Public bucket</Label>
                  <Input readOnly value={settings.supabase.isPublic ? "Yes" : "No"} />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Switching storage providers only affects new uploads. Existing files remain on their original
          backend ({PROVIDER_LABELS.local}, {PROVIDER_LABELS.s3}, or {PROVIDER_LABELS.supabase}).
        </p>
      </div>

      <AlertDialog open={pendingProvider !== null} onOpenChange={(open) => !open && setPendingProvider(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch storage provider?</AlertDialogTitle>
            <AlertDialogDescription>
              New files will be saved to {pendingProvider ? PROVIDER_LABELS[pendingProvider] : "the selected provider"}.
              Existing files will remain on their current storage backend.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmProviderSwitch}>
              Switch Provider
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
