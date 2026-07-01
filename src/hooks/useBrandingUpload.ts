import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type BrandingAssetType = "logo" | "favicon" | "login-bg";

interface UploadConstraints {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  label: string;
}

const CONSTRAINTS: Record<BrandingAssetType, UploadConstraints> = {
  logo: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"],
    allowedExtensions: [".png", ".jpg", ".jpeg", ".svg", ".webp"],
    label: "Logo",
  },
  favicon: {
    maxSizeBytes: 1 * 1024 * 1024, // 1 MB
    allowedMimeTypes: ["image/x-icon", "image/vnd.microsoft.icon", "image/png"],
    allowedExtensions: [".ico", ".png"],
    label: "Favicon",
  },
  "login-bg": {
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
    allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    label: "Login background",
  },
};

function validateFile(file: File, type: BrandingAssetType): string | null {
  const constraints = CONSTRAINTS[type];

  if (file.size > constraints.maxSizeBytes) {
    const maxMB = constraints.maxSizeBytes / (1024 * 1024);
    return `${constraints.label} must be smaller than ${maxMB} MB`;
  }

  if (!constraints.allowedMimeTypes.includes(file.type)) {
    return `${constraints.label} must be one of: ${constraints.allowedExtensions.join(", ")}`;
  }

  return null;
}

function buildStoragePath(type: BrandingAssetType, fileName: string): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "png";
  // Use a stable name per type so uploads replace the previous version
  return `${type}/current.${ext}`;
}

export interface UseBrandingUploadReturn {
  uploading: boolean;
  uploadAsset: (file: File, type: BrandingAssetType) => Promise<string | null>;
  removeAsset: (type: BrandingAssetType) => Promise<boolean>;
}

export function useBrandingUpload(): UseBrandingUploadReturn {
  const [uploading, setUploading] = useState(false);

  async function uploadAsset(file: File, type: BrandingAssetType): Promise<string | null> {
    const validationError = validateFile(file, type);
    if (validationError) {
      toast.error(validationError);
      return null;
    }

    setUploading(true);
    try {
      const path = buildStoragePath(type, file.name);

      // Remove any existing file at the same path first (upsert-style)
      await supabase.storage.from("branding-assets").remove([path]);

      const { error: uploadError } = await supabase.storage
        .from("branding-assets")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("branding-assets").getPublicUrl(path);

      return data.publicUrl;
    } catch (error: any) {
      toast.error(error.message || `Failed to upload ${CONSTRAINTS[type].label.toLowerCase()}`);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function removeAsset(type: BrandingAssetType): Promise<boolean> {
    setUploading(true);
    try {
      // List all files under the type prefix to find the current one
      const { data: files, error: listError } = await supabase.storage
        .from("branding-assets")
        .list(type);

      if (listError) throw listError;

      if (files && files.length > 0) {
        const paths = files.map((f) => `${type}/${f.name}`);
        const { error: removeError } = await supabase.storage
          .from("branding-assets")
          .remove(paths);
        if (removeError) throw removeError;
      }

      return true;
    } catch (error: any) {
      toast.error(error.message || `Failed to remove ${CONSTRAINTS[type].label.toLowerCase()}`);
      return false;
    } finally {
      setUploading(false);
    }
  }

  return { uploading, uploadAsset, removeAsset };
}
