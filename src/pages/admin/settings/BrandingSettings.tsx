import { useState, useEffect, useRef } from "react";
import { useAppConfig, useUpdateAppConfig } from "@/hooks/useAppConfig";
import { useBrandingUpload } from "@/hooks/useBrandingUpload";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Palette,
  Save,
  Upload,
  X,
  Image,
  Mail,
  Monitor,
  Loader2,
  Eye,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Local state shape for the form ───────────────────────────────────────────
interface BrandingForm {
  companyName: string;
  tagline: string;
  supportEmail: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  emailFromName: string;
  replyToEmail: string;
  loginMessage: string;
  loginBackgroundUrl: string;
}

const DEFAULTS: BrandingForm = {
  companyName: "Control Tower",
  tagline: "AI-Powered Collaboration Platform",
  supportEmail: "",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#6366f1",
  secondaryColor: "",
  emailFromName: "Control Tower",
  replyToEmail: "",
  loginMessage: "Welcome to Control Tower",
  loginBackgroundUrl: "",
};

// ─── Asset upload button ───────────────────────────────────────────────────────
interface AssetUploadButtonProps {
  label: string;
  accept: string;
  currentUrl: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
  previewClass?: string;
}

function AssetUploadButton({
  label,
  accept,
  currentUrl,
  uploading,
  onUpload,
  onRemove,
  previewClass = "h-12 w-12 object-contain",
}: AssetUploadButtonProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-4">
      {currentUrl ? (
        <div className="relative flex items-center justify-center rounded border bg-muted p-2">
          <img src={currentUrl} alt={label} className={previewClass} />
        </div>
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded border-2 border-dashed bg-muted text-muted-foreground">
          <Image className="h-6 w-6" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {currentUrl ? "Replace" : "Upload"}
          </Button>
          {currentUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={uploading}
              className="text-destructive hover:text-destructive"
            >
              <X className="mr-2 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{accept.replace(/,/g, " /")}</p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Live preview panel ────────────────────────────────────────────────────────
function BrandingPreview({ form }: { form: BrandingForm }) {
  return (
    <div className="sticky top-6 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Eye className="h-4 w-4" />
        Live Preview
      </div>

      {/* Login screen preview */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground">Login Page</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div
            className="relative flex min-h-[180px] flex-col items-center justify-center gap-3 p-6"
            style={{
              background: form.loginBackgroundUrl
                ? `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${form.loginBackgroundUrl}) center/cover no-repeat`
                : "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
            }}
          >
            {form.logoUrl && (
              <img
                src={form.logoUrl}
                alt="logo"
                className="h-10 w-auto object-contain"
              />
            )}
            <p className="text-center text-sm font-semibold text-primary-foreground">
              {form.loginMessage || DEFAULTS.loginMessage}
            </p>
            <p className="text-center text-xs text-primary-foreground/70">
              {form.tagline || DEFAULTS.tagline}
            </p>
            <div
              className="mt-2 rounded px-4 py-1.5 text-xs font-medium text-primary-foreground"
              style={{ backgroundColor: form.primaryColor || DEFAULTS.primaryColor }}
            >
              Sign In
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sidebar header preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground">Sidebar Header</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded border bg-muted/50 p-3">
            {form.logoUrl ? (
              <img src={form.logoUrl} alt="logo" className="h-7 w-7 object-contain" />
            ) : (
              <div
                className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-primary-foreground"
                style={{ backgroundColor: form.primaryColor || DEFAULTS.primaryColor }}
              >
                {(form.companyName || DEFAULTS.companyName).charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold leading-tight">
                {form.companyName || DEFAULTS.companyName}
              </p>
              <p className="text-xs text-muted-foreground leading-tight">
                {form.tagline || DEFAULTS.tagline}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Button / accent preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground">Buttons & Accents</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <button
            className="rounded px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            style={{ backgroundColor: form.primaryColor || DEFAULTS.primaryColor }}
          >
            Primary Action
          </button>
          {form.secondaryColor && (
            <button
              className="rounded px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              style={{ backgroundColor: form.secondaryColor }}
            >
              Secondary
            </button>
          )}
          <span
            className="text-xs underline cursor-pointer"
            style={{ color: form.primaryColor || DEFAULTS.primaryColor }}
          >
            Link text
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function BrandingSettings() {
  const { data: config, isLoading } = useAppConfig();
  const updateConfig = useUpdateAppConfig();
  const { uploading, uploadAsset, removeAsset } = useBrandingUpload();

  const [form, setForm] = useState<BrandingForm>(DEFAULTS);

  // Sync form from loaded config
  useEffect(() => {
    if (config) {
      setForm({
        companyName: config.branding.companyName || DEFAULTS.companyName,
        tagline: config.branding.tagline || DEFAULTS.tagline,
        supportEmail: config.branding.supportEmail || "",
        logoUrl: config.branding.logoUrl || "",
        faviconUrl: config.branding.faviconUrl || "",
        primaryColor: config.branding.primaryColor || DEFAULTS.primaryColor,
        secondaryColor: config.branding.secondaryColor || "",
        emailFromName: config.branding.emailFromName || "",
        replyToEmail: config.branding.replyToEmail || "",
        loginMessage: config.branding.loginMessage || DEFAULTS.loginMessage,
        loginBackgroundUrl: config.branding.loginBackgroundUrl || "",
      });
    }
  }, [config]);

  const isSaving = updateConfig.isPending;
  const isBusy = isSaving || uploading;

  function patch(updates: Partial<BrandingForm>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  async function handleSave() {
    if (!config) return;

    await updateConfig.mutateAsync({
      ...config,
      branding: {
        ...config.branding,
        companyName: form.companyName,
        tagline: form.tagline,
        supportEmail: form.supportEmail,
        logoUrl: form.logoUrl || undefined,
        faviconUrl: form.faviconUrl || undefined,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor || undefined,
        emailFromName: form.emailFromName || undefined,
        replyToEmail: form.replyToEmail || undefined,
        loginMessage: form.loginMessage,
        loginBackgroundUrl: form.loginBackgroundUrl || undefined,
      },
    });
  }

  async function handleAssetUpload(
    file: File,
    type: "logo" | "favicon" | "login-bg",
    field: keyof BrandingForm
  ) {
    const url = await uploadAsset(file, type);
    if (url) {
      patch({ [field]: url });
      toast.success("Asset uploaded — save to persist changes.");
    }
  }

  async function handleAssetRemove(type: "logo" | "favicon" | "login-bg", field: keyof BrandingForm) {
    const removed = await removeAsset(type);
    if (removed) {
      patch({ [field]: "" });
      toast.success("Asset removed — save to persist changes.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Branding</h1>
          <p className="text-muted-foreground">
            Customize your tenant's appearance across the entire platform
          </p>
        </div>
        <Button onClick={handleSave} disabled={isBusy}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left column: settings ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Company identity */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <CardTitle>Company Identity</CardTitle>
              </div>
              <CardDescription>
                Name and tagline shown throughout the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={(e) => patch({ companyName: e.target.value })}
                  placeholder="Control Tower"
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={form.tagline}
                  onChange={(e) => patch({ tagline: e.target.value })}
                  placeholder="AI-Powered Collaboration Platform"
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={form.supportEmail}
                  onChange={(e) => patch({ supportEmail: e.target.value })}
                  placeholder="support@yourcompany.com"
                  disabled={isBusy}
                />
              </div>
            </CardContent>
          </Card>

          {/* Logo */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                <CardTitle>Company Logo</CardTitle>
              </div>
              <CardDescription>
                Used in the sidebar, header, reports, and emails. PNG, JPG, SVG or WebP — max 5 MB.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AssetUploadButton
                label="Logo"
                accept=".png,.jpg,.jpeg,.svg,.webp"
                currentUrl={form.logoUrl}
                uploading={uploading}
                onUpload={(file) => handleAssetUpload(file, "logo", "logoUrl")}
                onRemove={() => handleAssetRemove("logo", "logoUrl")}
                previewClass="h-12 max-w-[200px] object-contain"
              />
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL (manual override)</Label>
                <Input
                  id="logoUrl"
                  value={form.logoUrl}
                  onChange={(e) => patch({ logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  disabled={isBusy}
                />
                <p className="text-xs text-muted-foreground">
                  Use this if your logo is hosted externally and you don't need to upload.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Favicon */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                <CardTitle>Favicon</CardTitle>
              </div>
              <CardDescription>
                Shown in browser tabs and the login page. ICO or PNG — max 1 MB.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AssetUploadButton
                label="Favicon"
                accept=".ico,.png"
                currentUrl={form.faviconUrl}
                uploading={uploading}
                onUpload={(file) => handleAssetUpload(file, "favicon", "faviconUrl")}
                onRemove={() => handleAssetRemove("favicon", "faviconUrl")}
                previewClass="h-8 w-8 object-contain"
              />
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="faviconUrl">Favicon URL (manual override)</Label>
                <Input
                  id="faviconUrl"
                  value={form.faviconUrl}
                  onChange={(e) => patch({ faviconUrl: e.target.value })}
                  placeholder="https://example.com/favicon.ico"
                  disabled={isBusy}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand colors */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                <CardTitle>Brand Colors</CardTitle>
              </div>
              <CardDescription>
                Colors used for buttons, links, accents, and charts across the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Primary Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primaryColor || "#6366f1"}
                    onChange={(e) => patch({ primaryColor: e.target.value })}
                    disabled={isBusy}
                    className="h-10 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                    title="Pick primary color"
                  />
                  <Input
                    value={form.primaryColor}
                    onChange={(e) => patch({ primaryColor: e.target.value })}
                    placeholder="#6366f1"
                    disabled={isBusy}
                    className="w-36 font-mono text-sm"
                    maxLength={7}
                  />
                  <div
                    className="h-10 w-10 rounded border"
                    style={{ backgroundColor: form.primaryColor || "#6366f1" }}
                    title="Color preview"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for primary buttons, active links, and highlighted elements.
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Secondary Color <span className="text-muted-foreground">(optional)</span></Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.secondaryColor || "#8b5cf6"}
                    onChange={(e) => patch({ secondaryColor: e.target.value })}
                    disabled={isBusy}
                    className="h-10 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                    title="Pick secondary color"
                  />
                  <Input
                    value={form.secondaryColor}
                    onChange={(e) => patch({ secondaryColor: e.target.value })}
                    placeholder="#8b5cf6"
                    disabled={isBusy}
                    className="w-36 font-mono text-sm"
                    maxLength={7}
                  />
                  {form.secondaryColor && (
                    <div
                      className="h-10 w-10 rounded border"
                      style={{ backgroundColor: form.secondaryColor }}
                      title="Color preview"
                    />
                  )}
                  {form.secondaryColor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => patch({ secondaryColor: "" })}
                      disabled={isBusy}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for secondary UI elements and supporting accents.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email branding */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <CardTitle>Email Branding</CardTitle>
              </div>
              <CardDescription>
                Display information on outgoing invitations, notifications, and password reset emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emailFromName">From Name</Label>
                <Input
                  id="emailFromName"
                  value={form.emailFromName}
                  onChange={(e) => patch({ emailFromName: e.target.value })}
                  placeholder="Control Tower"
                  disabled={isBusy}
                />
                <p className="text-xs text-muted-foreground">
                  Displayed as the sender name in email clients, e.g. "Control Tower".
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="replyToEmail">Reply-To Email</Label>
                <Input
                  id="replyToEmail"
                  type="email"
                  value={form.replyToEmail}
                  onChange={(e) => patch({ replyToEmail: e.target.value })}
                  placeholder="support@yourcompany.com"
                  disabled={isBusy}
                />
                <p className="text-xs text-muted-foreground">
                  Replies to automated emails will be directed here.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supportEmailBranding">Support Email</Label>
                <Input
                  id="supportEmailBranding"
                  type="email"
                  value={form.supportEmail}
                  onChange={(e) => patch({ supportEmail: e.target.value })}
                  placeholder="support@yourcompany.com"
                  disabled={isBusy}
                />
                <p className="text-xs text-muted-foreground">
                  Shown as the help contact in email footers and error pages.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Login page */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                <CardTitle>Login Page</CardTitle>
              </div>
              <CardDescription>
                Customize the first thing users see when they visit your platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loginMessage">Welcome Message</Label>
                <Input
                  id="loginMessage"
                  value={form.loginMessage}
                  onChange={(e) => patch({ loginMessage: e.target.value })}
                  placeholder="Welcome to Control Tower"
                  disabled={isBusy}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Login Background Image</Label>
                <AssetUploadButton
                  label="Background"
                  accept=".png,.jpg,.jpeg,.webp"
                  currentUrl={form.loginBackgroundUrl}
                  uploading={uploading}
                  onUpload={(file) => handleAssetUpload(file, "login-bg", "loginBackgroundUrl")}
                  onRemove={() => handleAssetRemove("login-bg", "loginBackgroundUrl")}
                  previewClass="h-16 max-w-[120px] object-cover rounded"
                />
                <Separator className="mt-2" />
                <Label htmlFor="loginBackgroundUrl">Background URL (manual override)</Label>
                <Input
                  id="loginBackgroundUrl"
                  value={form.loginBackgroundUrl}
                  onChange={(e) => patch({ loginBackgroundUrl: e.target.value })}
                  placeholder="https://example.com/background.jpg"
                  disabled={isBusy}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: live preview ── */}
        <div className="lg:col-span-1">
          <BrandingPreview form={form} />
        </div>
      </div>

      {/* Floating save bar at bottom for convenience */}
      <div className="flex justify-end border-t pt-4">
        <Button onClick={handleSave} disabled={isBusy} size="lg">
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save All Changes
        </Button>
      </div>
    </div>
  );
}
