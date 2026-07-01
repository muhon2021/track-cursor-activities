/**
 * SendGrid Integration - Dedicated Admin Page
 * API key stored only in Supabase secrets; UI shows validation status only.
 */
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Settings,
  RefreshCw,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { integrationKeys } from "@/hooks/useIntegrations";
import { supabase } from "@/integrations/supabase/client";
import {
  useSendGridConfig,
  useUpdateSendGridConfig,
  syncSendGridOrganizationIntegration,
  type UpdateSendGridConfigInput,
} from "@/hooks/useSendGridConfig";
import { FunctionsHttpError } from "@supabase/supabase-js";

const formSchema = z.object({
  from_email: z.string().email("Valid email required"),
  from_name: z.string().min(1, "From name required"),
  api_key: z.string().optional(),
  is_enabled: z.boolean(),
  enable_open_tracking: z.boolean(),
  enable_click_tracking: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

type ApiKeyStatus = "checking" | "valid" | "not_configured" | "invalid";

export default function SendGridIntegration() {
  const queryClient = useQueryClient();
  const { data: config, isLoading: configLoading } = useSendGridConfig();
  const updateConfig = useUpdateSendGridConfig();
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>("checking");
  const [isValidating, setIsValidating] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const hubSyncedRef = useRef(false);

  const invalidateIntegrationHub = () => {
    queryClient.invalidateQueries({ queryKey: integrationKeys.orgIntegrations() });
    queryClient.invalidateQueries({ queryKey: integrationKeys.all });
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      from_email: "noreply@sjinnovation.com",
      from_name: "SJ Innovation",
      api_key: "",
      is_enabled: false,
      enable_open_tracking: true,
      enable_click_tracking: true,
    },
  });

  useEffect(() => {
    if (config) {
      form.reset({
        from_email: config.from_email || "noreply@sjinnovation.com",
        from_name: config.from_name || "SJ Innovation",
        api_key: "", // Never pre-fill; show placeholder if key exists
        is_enabled: config.is_enabled ?? false,
        enable_open_tracking: config.enable_open_tracking ?? true,
        enable_click_tracking: config.enable_click_tracking ?? true,
      });
    }
  }, [config, form]);

  const validateConnection = async (showToast = false) => {
    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("sendgrid-validate", {});
      if (error) throw error;
      const result = data as { success?: boolean; message?: string };
      if (result?.success) {
        setApiKeyStatus("valid");
        if (showToast) toast.success(result.message || "API key is valid");
        if (config?.is_enabled) {
          void syncSendGridOrganizationIntegration(true, {
            from_email: config.from_email,
            from_name: config.from_name,
            is_enabled: config.is_enabled,
          }).then(invalidateIntegrationHub);
        }
      } else {
        setApiKeyStatus("invalid");
        if (showToast) toast.error(result?.message || "API key invalid or connection failed");
      }
    } catch (err) {
      if (err instanceof FunctionsHttpError) {
        try {
          const json = await err.context.json();
          setApiKeyStatus(json?.success === true ? "valid" : "invalid");
          if (showToast) toast.error(json?.message || "Validation failed");
        } catch {
          setApiKeyStatus("invalid");
          if (showToast) toast.error("Validation failed");
        }
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (msg.includes("not configured")) {
          setApiKeyStatus("not_configured");
        } else {
          setApiKeyStatus("invalid");
        }
        if (showToast) toast.error(msg);
      }
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    validateConnection(false);
  }, []);

  useEffect(() => {
    if (hubSyncedRef.current || !config?.is_enabled || apiKeyStatus !== "valid") return;
    hubSyncedRef.current = true;
    void syncSendGridOrganizationIntegration(true, {
      from_email: config.from_email,
      from_name: config.from_name,
      is_enabled: config.is_enabled,
    }).then(invalidateIntegrationHub);
  }, [config, apiKeyStatus, queryClient]);

  const onSubmit = (values: FormValues) => {
    const payload: UpdateSendGridConfigInput = {
      from_email: values.from_email,
      from_name: values.from_name,
      is_enabled: values.is_enabled,
      enable_open_tracking: values.enable_open_tracking,
      enable_click_tracking: values.enable_click_tracking,
    };
    if (values.api_key && values.api_key.trim()) {
      payload.api_key = values.api_key.trim();
    }
    updateConfig.mutate(payload);
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim() || !form.watch("is_enabled")) return;
    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: [testEmail.trim()],
          subject: "SendGrid Test Email",
          body: "This is a test email from the SJ Control Tower SendGrid integration. If you received this, the integration is working correctly.",
          enableTracking: form.watch("enable_open_tracking") || form.watch("enable_click_tracking"),
        },
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string };
      if (result?.success) {
        toast.success("Test email sent successfully");
      } else {
        toast.error(result?.error || "Failed to send test email");
      }
    } catch (err) {
      if (err instanceof FunctionsHttpError) {
        try {
          const json = await err.context.json();
          const msg = json?.error || json?.details || "Failed to send";
          if (msg.includes("not enabled")) toast.error("SendGrid integration is not enabled. Save configuration with Enable SendGrid turned on first.");
          else if (msg.includes("Sender not verified") || msg.includes("verified")) toast.error("Sender not verified. Add and verify your sender in SendGrid.");
          else if (msg.includes("API key invalid")) toast.error("API key invalid. Check SENDGRID_API_KEY in Supabase secrets.");
          else toast.error(msg);
        } catch {
          toast.error("Failed to send test email");
        }
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to send test email");
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  const apiKeyStatusText =
    apiKeyStatus === "checking"
      ? "Checking…"
      : apiKeyStatus === "valid"
        ? "API Key configured and valid"
        : apiKeyStatus === "not_configured"
          ? "API Key not configured in Supabase secrets"
          : "API Key invalid or connection failed";

  const isEnabled = form.watch("is_enabled");

  if (configLoading && !config) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <Link
        to="/admin/integrations"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Integrations
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-3 shadow-lg">
            <Mail className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SendGrid</h1>
            <p className="text-muted-foreground">
              Configure transactional email. API key is stored in Supabase secrets only.
            </p>
          </div>
        </div>
        <Badge
          variant={isEnabled ? "default" : "secondary"}
          className={isEnabled ? "bg-emerald-600" : ""}
        >
          {isEnabled ? (
            <>
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Connected
            </>
          ) : (
            <>
              <AlertCircle className="mr-1 h-3 w-3" />
              Disconnected
            </>
          )}
        </Badge>
      </div>

      {/* API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            API Key
          </CardTitle>
          <CardDescription>
            Enter your SendGrid API key. You can also set SENDGRID_API_KEY in Supabase Edge Function secrets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api_key">SendGrid API Key</Label>
            <Input
              id="api_key"
              type="password"
              autoComplete="off"
              placeholder="SG.xxxxxxxx... (leave blank to keep current)"
              {...form.register("api_key")}
            />
            <p className="text-xs text-muted-foreground">
              Get your key from SendGrid → Settings → API Keys. Save the form below to store it.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              {apiKeyStatus === "checking" || isValidating ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : apiKeyStatus === "valid" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              )}
              <span className="font-medium">{apiKeyStatusText}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => validateConnection(true)}
              disabled={isValidating}
            >
              {isValidating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Validate Connection
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <a
              href="https://app.sendgrid.com/settings/api_keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Get API Key from SendGrid <ExternalLink className="h-3 w-3" />
            </a>
            {" · "}
            <a
              href="https://app.sendgrid.com/settings/sender_auth"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Verify sender in SendGrid <ExternalLink className="h-3 w-3" />
            </a>
            {" · "}
            Set SENDGRID_API_KEY in Supabase Dashboard → Project Settings → Edge Functions → Secrets.
          </p>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>From address, name, and tracking options</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from_email">From Email</Label>
                <Input
                  id="from_email"
                  type="email"
                  {...form.register("from_email")}
                  placeholder="noreply@company.com"
                />
                {form.formState.errors.from_email && (
                  <p className="text-sm text-destructive">{form.formState.errors.from_email.message}</p>
                )}
                <p className="text-xs text-muted-foreground">Must be verified in SendGrid</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_name">From Name</Label>
                <Input
                  id="from_name"
                  {...form.register("from_name")}
                  placeholder="Your Company"
                />
                {form.formState.errors.from_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.from_name.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="is_enabled">Enable SendGrid</Label>
                <p className="text-sm text-muted-foreground">Turn on to send emails via SendGrid</p>
              </div>
              <Switch
                id="is_enabled"
                checked={form.watch("is_enabled")}
                onCheckedChange={(v) => form.setValue("is_enabled", v)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="open">Enable Open Tracking</Label>
                <p className="text-sm text-muted-foreground">Track when emails are opened</p>
              </div>
              <Switch
                id="open"
                checked={form.watch("enable_open_tracking")}
                onCheckedChange={(v) => form.setValue("enable_open_tracking", v)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="click">Enable Click Tracking</Label>
                <p className="text-sm text-muted-foreground">Track when links in emails are clicked</p>
              </div>
              <Switch
                id="click"
                checked={form.watch("enable_click_tracking")}
                onCheckedChange={(v) => form.setValue("enable_click_tracking", v)}
              />
            </div>

            <Button type="submit" disabled={updateConfig.isPending}>
              {updateConfig.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Test Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Test Email
          </CardTitle>
          <CardDescription>Send a test email to verify the integration</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="test_email">Recipient Email</Label>
            <Input
              id="test_email"
              type="email"
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              disabled={!isEnabled}
            />
          </div>
          <Button
            onClick={handleSendTestEmail}
            disabled={!isEnabled || !testEmail.trim() || isSendingTest}
          >
            {isSendingTest ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Test Email
              </>
            )}
          </Button>
        </CardContent>
        {!isEnabled && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              Enable SendGrid above and save to send test emails.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
