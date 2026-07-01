import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type KnowledgeFileType =
  | "document"
  | "image"
  | "audio"
  | "video"
  | "archive"
  | "code"
  | "other";

export type KnowledgeStorageType = "local" | "s3" | "supabase";
export type SharedPermission = "read" | "write";

export interface SharedUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  permissions: SharedPermission;
  addedAt?: string;
  excluded?: boolean;
}

export interface KnowledgeFolder {
  id: string;
  name: string;
  color: string;
  items: number;
  fileCount: number;
  modified: string;
  size: string | number;
  sharedWith: SharedUser[];
  userId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerAvatar?: string;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  type: KnowledgeFileType | string;
  size: string;
  sizeBytes: number;
  modified: string;
  isStarred: boolean;
  usedIn: string[];
  folderId: string | null;
  sharedWith: SharedUser[];
  uploadedAt: Date;
  storageType?: KnowledgeStorageType;
  url: string;
  path: string;
  mimeType: string;
  userId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerAvatar?: string;
}

export interface CreateFolderInput {
  name: string;
  color?: string;
}

export interface UpdateFolderInput {
  name?: string;
  color?: string;
  sharedWith?: SharedUser[];
  isPublic?: boolean;
  isShared?: boolean;
}

export interface UpdateFileInput {
  name?: string;
  folderId?: string | null;
  isStarred?: boolean;
  sharedWith?: SharedUser[];
  isPublic?: boolean;
  isShared?: boolean;
}

export interface ListFilesOptions {
  folderId?: string | null;
  search?: string;
  type?: KnowledgeFileType | string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<TItem> {
  data: TItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface KnowledgeFolderRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_public: boolean;
  is_shared: boolean;
  size: number;
  file_count: number;
  shared_with: unknown;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface KnowledgeFileRow {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  size: number;
  type: string;
  mime_type: string;
  path: string;
  url: string;
  s3_key: string | null;
  storage_path: string | null;
  storage_type: KnowledgeStorageType;
  is_public: boolean;
  is_shared: boolean;
  is_starred: boolean;
  metadata: unknown;
  openai: unknown;
  shared_with: unknown;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface KnowledgeDatabase {
  public: {
    Tables: {
      folders: {
        Row: KnowledgeFolderRow;
        Insert: Partial<KnowledgeFolderRow> & Pick<KnowledgeFolderRow, "user_id" | "name">;
        Update: Partial<KnowledgeFolderRow>;
      };
      files: {
        Row: KnowledgeFileRow;
        Insert: Partial<KnowledgeFileRow> &
          Pick<
            KnowledgeFileRow,
            "id" | "user_id" | "name" | "original_name" | "size" | "type" | "mime_type" | "path" | "url"
          >;
        Update: Partial<KnowledgeFileRow>;
      };
    };
  };
}

const knowledgeSupabase = supabase as unknown as SupabaseClient<KnowledgeDatabase>;
const LOCAL_STORAGE_BUCKET = "knowledgebase";

interface KnowledgeFileStorageResponse {
  success?: boolean;
  data?: KnowledgeFileRow[];
  message?: string;
}

interface KnowledgeDownloadUrlResponse {
  success?: boolean;
  data?: { url: string };
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSharedWith(value: unknown): SharedUser[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is SharedUser => {
    if (!isRecord(entry)) {
      return false;
    }

    return (
      typeof entry.id === "string" &&
      typeof entry.name === "string" &&
      typeof entry.email === "string" &&
      (entry.permissions === "read" || entry.permissions === "write")
    );
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const unit = 1024;
  const labels = ["Bytes", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(unit)), labels.length - 1);
  return `${Number((bytes / unit ** index).toFixed(2))} ${labels[index]}`;
}

function mapFolder(row: KnowledgeFolderRow): KnowledgeFolder {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    items: row.file_count,
    fileCount: row.file_count,
    modified: row.updated_at,
    size: row.size,
    sharedWith: parseSharedWith(row.shared_with),
    userId: row.user_id,
  };
}

function mapFile(row: KnowledgeFileRow): KnowledgeFile {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    size: formatBytes(row.size),
    sizeBytes: row.size,
    modified: row.updated_at,
    isStarred: row.is_starred,
    usedIn: [],
    folderId: row.folder_id,
    sharedWith: parseSharedWith(row.shared_with),
    uploadedAt: new Date(row.created_at),
    storageType: row.storage_type,
    url: row.url,
    path: row.path,
    mimeType: row.mime_type,
    userId: row.user_id,
  };
}

function getFileType(file: File): KnowledgeFileType {
  const mimeType = file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z")) return "archive";
  if (["js", "jsx", "ts", "tsx", "json", "xml", "html", "css", "py", "sql"].includes(extension)) return "code";
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation") ||
    ["md", "csv", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(extension)
  ) {
    return "document";
  }

  return "other";
}

function safeStorageName(fileName: string): string {
  const extension = fileName.includes(".") ? `.${fileName.split(".").pop() ?? ""}` : "";
  return extension.toLowerCase();
}

async function getActiveStorageType(): Promise<KnowledgeStorageType> {
  const { data } = await supabase
    .from("storage_config_public")
    .select("storage_type")
    .limit(1)
    .maybeSingle();

  const storageType = data?.storage_type;
  if (storageType === "s3" || storageType === "supabase" || storageType === "local") {
    return storageType;
  }

  return "local";
}

async function uploadFilesLocally(
  files: File[],
  folderId?: string | null,
): Promise<KnowledgeFile[]> {
  const userId = await getCurrentUserId();
  const uploadedFiles: KnowledgeFile[] = [];

  for (const file of files) {
    const fileId = crypto.randomUUID();
    const storagePath = `${userId}/${fileId}${safeStorageName(file.name)}`;

    const { error: uploadError } = await knowledgeSupabase.storage
      .from(LOCAL_STORAGE_BUCKET)
      .upload(storagePath, file, { upsert: true, contentType: file.type || "application/octet-stream" });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = knowledgeSupabase.storage.from(LOCAL_STORAGE_BUCKET).getPublicUrl(storagePath);
    const { data, error } = await knowledgeSupabase
      .from("files")
      .insert({
        id: fileId,
        user_id: userId,
        folder_id: folderId ?? null,
        name: file.name,
        original_name: file.name,
        size: file.size,
        type: getFileType(file),
        mime_type: file.type || "application/octet-stream",
        path: storagePath,
        url: publicUrlData.publicUrl,
        storage_type: "local",
        storage_path: storagePath,
        metadata: { originalName: file.name },
      })
      .select()
      .single();

    if (error) {
      await knowledgeSupabase.storage.from(LOCAL_STORAGE_BUCKET).remove([storagePath]);
      throw error;
    }

    uploadedFiles.push(mapFile(data));
  }

  return uploadedFiles;
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await knowledgeSupabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("User not authenticated");
  }

  return data.user.id;
}

interface HiddenResourceRow {
  resource_type: "file" | "folder";
  resource_id: string;
}

async function getHiddenResourceIds(): Promise<{ files: Set<string>; folders: Set<string> }> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("knowledge_hidden_items")
    .select("resource_type, resource_id")
    .eq("user_id", userId);

  if (error) {
    console.warn("Failed to load hidden knowledge items:", error.message);
    return { files: new Set(), folders: new Set() };
  }

  const files = new Set<string>();
  const folders = new Set<string>();

  for (const row of (data ?? []) as HiddenResourceRow[]) {
    if (row.resource_type === "file") {
      files.add(row.resource_id);
    } else {
      folders.add(row.resource_id);
    }
  }

  return { files, folders };
}

export async function hideSharedResource(
  resourceType: "file" | "folder",
  resourceId: string,
): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("knowledge_hidden_items")
    .upsert(
      {
        user_id: userId,
        resource_type: resourceType,
        resource_id: resourceId,
      },
      { onConflict: "user_id,resource_type,resource_id" },
    );

  if (error) {
    throw error;
  }
}

export async function createFolder(name: string, color = "#6b7280"): Promise<KnowledgeFolder> {
  const userId = await getCurrentUserId();
  const { data, error } = await knowledgeSupabase
    .from("folders")
    .insert({ user_id: userId, name: name.trim(), color })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapFolder(data);
}

export async function listFolders(): Promise<KnowledgeFolder[]> {
  const hidden = await getHiddenResourceIds();
  const { data, error } = await knowledgeSupabase
    .from("folders")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row) => !hidden.folders.has(row.id))
    .map(mapFolder);
}

export async function updateFolder(id: string, input: UpdateFolderInput): Promise<KnowledgeFolder> {
  const updateData: Partial<KnowledgeFolderRow> = {};

  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.color !== undefined) updateData.color = input.color;
  if (input.sharedWith !== undefined) {
    updateData.shared_with = input.sharedWith;
    updateData.is_shared = input.sharedWith.length > 0;
  }
  if (input.isPublic !== undefined) updateData.is_public = input.isPublic;
  if (input.isShared !== undefined) updateData.is_shared = input.isShared;

  const { data, error } = await knowledgeSupabase
    .from("folders")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapFolder(data);
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await knowledgeSupabase.from("folders").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function uploadFiles(files: File[], folderId?: string | null): Promise<KnowledgeFile[]> {
  const activeStorageType = await getActiveStorageType();

  if (activeStorageType === "local") {
    try {
      const formData = new FormData();
      formData.append("action", "upload");
      files.forEach((file) => formData.append("files", file));
      formData.append("folder_id", folderId ?? "null");

      const { data, error } = await supabase.functions.invoke("knowledge-file-storage", {
        body: formData,
      });

      if (!error) {
        const result = data as KnowledgeFileStorageResponse;
        if (result.success && result.data) {
          return result.data.map(mapFile);
        }
      }
    } catch {
      // Fall back to direct local upload when the edge function is unavailable.
    }

    return uploadFilesLocally(files, folderId);
  }

  const formData = new FormData();
  formData.append("action", "upload");
  files.forEach((file) => formData.append("files", file));
  formData.append("folder_id", folderId ?? "null");

  const { data, error } = await supabase.functions.invoke("knowledge-file-storage", {
    body: formData,
  });

  if (error) {
    throw error;
  }

  const result = data as KnowledgeFileStorageResponse;
  if (!result.success || !result.data) {
    throw new Error(result.message ?? "Failed to upload files");
  }

  return result.data.map(mapFile);
}

export async function listFiles(options: ListFilesOptions = {}): Promise<PaginatedResponse<KnowledgeFile>> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 1000;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = knowledgeSupabase
    .from("files")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (options.folderId === null) {
    query = query.is("folder_id", null);
  } else if (options.folderId) {
    query = query.eq("folder_id", options.folderId);
  }

  if (options.search) {
    query = query.ilike("name", `%${options.search}%`);
  }

  if (options.type) {
    query = query.eq("type", options.type);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const hidden = await getHiddenResourceIds();
  const total = count ?? 0;
  const visibleData = (data ?? []).filter((row) => !hidden.files.has(row.id));

  return {
    data: visibleData.map(mapFile),
    pagination: {
      page,
      limit,
      total: visibleData.length,
      totalPages: Math.max(1, Math.ceil(visibleData.length / limit)),
    },
  };
}

export async function updateFile(id: string, input: UpdateFileInput): Promise<KnowledgeFile> {
  const updateData: Partial<KnowledgeFileRow> = {};

  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.folderId !== undefined) updateData.folder_id = input.folderId;
  if (input.isStarred !== undefined) updateData.is_starred = input.isStarred;
  if (input.sharedWith !== undefined) {
    updateData.shared_with = input.sharedWith;
    updateData.is_shared = input.sharedWith.length > 0;
  }
  if (input.isPublic !== undefined) updateData.is_public = input.isPublic;
  if (input.isShared !== undefined) updateData.is_shared = input.isShared;

  const { data, error } = await knowledgeSupabase
    .from("files")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapFile(data);
}

export async function deleteFile(id: string): Promise<void> {
  const { data: file, error: fileError } = await knowledgeSupabase
    .from("files")
    .select("path, storage_path, storage_type")
    .eq("id", id)
    .single();

  if (fileError) {
    throw fileError;
  }

  if (file.storage_type === "local") {
    const { error } = await knowledgeSupabase.from("files").delete().eq("id", id);
    if (error) {
      throw error;
    }

    const objectPath = file.storage_path ?? file.path;
    if (objectPath) {
      await knowledgeSupabase.storage.from(LOCAL_STORAGE_BUCKET).remove([objectPath]);
    }
    return;
  }

  const { data, error } = await supabase.functions.invoke("knowledge-file-storage", {
    body: { action: "delete", fileId: id },
  });

  if (error) {
    throw error;
  }

  const result = data as { success?: boolean; message?: string };
  if (!result.success) {
    throw new Error(result.message ?? "Failed to delete file");
  }
}

export async function downloadFile(file: KnowledgeFile): Promise<void> {
  if (file.storageType === "local" && file.url) {
    window.open(file.url, "_blank", "noopener,noreferrer");
    return;
  }

  const { data, error } = await supabase.functions.invoke("knowledge-file-storage", {
    body: { action: "download-url", fileId: file.id },
  });

  if (error) {
    throw error;
  }

  const result = data as KnowledgeDownloadUrlResponse;
  if (!result.success || !result.data?.url) {
    throw new Error(result.message ?? "Failed to get download URL");
  }

  window.open(result.data.url, "_blank", "noopener,noreferrer");
}
