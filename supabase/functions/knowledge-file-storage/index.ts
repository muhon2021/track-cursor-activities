import {
  corsHeaders,
  createServiceClient,
  getStorageConfig,
  jsonResponse,
  requireAuthenticatedUser,
} from "../_shared/storage-auth.ts";
import {
  deleteFromStorage,
  getDownloadUrl,
  uploadToActiveStorage,
} from "../_shared/storage-operations.ts";

type KnowledgeFileType = "document" | "image" | "audio" | "video" | "archive" | "code" | "other";

interface KnowledgeFileActionBody {
  action: "delete" | "download-url";
  fileId: string;
}

function getFileType(fileName: string, mimeType: string): KnowledgeFileType {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const normalizedMime = mimeType.toLowerCase();

  if (normalizedMime.startsWith("image/")) return "image";
  if (normalizedMime.startsWith("audio/")) return "audio";
  if (normalizedMime.startsWith("video/")) return "video";
  if (normalizedMime.includes("zip") || normalizedMime.includes("rar") || normalizedMime.includes("7z")) {
    return "archive";
  }
  if (["js", "jsx", "ts", "tsx", "json", "xml", "html", "css", "py", "sql"].includes(extension)) {
    return "code";
  }
  if (
    normalizedMime.startsWith("text/") ||
    normalizedMime.includes("pdf") ||
    normalizedMime.includes("document") ||
    normalizedMime.includes("spreadsheet") ||
    normalizedMime.includes("presentation") ||
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

function isJsonRequest(req: Request): boolean {
  const contentType = req.headers.get("content-type") ?? "";
  return contentType.includes("application/json");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    const supabase = createServiceClient();
    const user = await requireAuthenticatedUser(req, supabase);

    if (isJsonRequest(req)) {
      const body = await req.json() as KnowledgeFileActionBody;

      if (body.action === "delete") {
        const { data: file, error: fileError } = await supabase
          .from("files")
          .select("id, user_id, path, s3_key, storage_path, storage_type")
          .eq("id", body.fileId)
          .single();

        if (fileError || !file) {
          return jsonResponse({ success: false, message: "File not found" }, 404);
        }

        if (file.user_id !== user.id) {
          return jsonResponse({ success: false, message: "Not authorized to delete this file" }, 403);
        }

        const config = await getStorageConfig(supabase);
        await deleteFromStorage(
          file.storage_type,
          config,
          file.path,
          file.s3_key,
          file.storage_path,
        );

        const { error } = await supabase.from("files").delete().eq("id", body.fileId);
        if (error) {
          throw error;
        }

        return jsonResponse({ success: true });
      }

      if (body.action === "download-url") {
        const { data: file, error: fileError } = await supabase
          .from("files")
          .select("id, user_id, path, url, s3_key, storage_path, storage_type, is_public, shared_with")
          .eq("id", body.fileId)
          .single();

        if (fileError || !file) {
          return jsonResponse({ success: false, message: "File not found" }, 404);
        }

        const isOwner = file.user_id === user.id;
        const isShared = Array.isArray(file.shared_with) &&
          file.shared_with.some((entry: { id?: string }) => entry.id === user.id);

        if (!isOwner && !file.is_public && !isShared) {
          return jsonResponse({ success: false, message: "Not authorized to access this file" }, 403);
        }

        const config = await getStorageConfig(supabase);
        const downloadUrl = await getDownloadUrl(
          file.storage_type,
          config,
          file.path,
          file.s3_key,
          file.storage_path,
        );

        return jsonResponse({ success: true, data: { url: downloadUrl } });
      }

      return jsonResponse({ success: false, message: "Unsupported action" }, 400);
    }

    const formData = await req.formData();
    const action = formData.get("action");
    if (action !== "upload") {
      return jsonResponse({ success: false, message: "Unsupported action" }, 400);
    }

    const folderId = formData.get("folder_id");
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return jsonResponse({ success: false, message: "No files provided" }, 400);
    }

    const config = await getStorageConfig(supabase);
    const uploadedFiles = [];

    for (const file of files) {
      const fileId = crypto.randomUUID();
      const storagePath = `${user.id}/${fileId}${safeStorageName(file.name)}`;
      const buffer = new Uint8Array(await file.arrayBuffer());
      const uploadResult = await uploadToActiveStorage(config, {
        buffer,
        storagePath,
        mimeType: file.type || "application/octet-stream",
        fileName: file.name,
      });

      const { data, error } = await supabase
        .from("files")
        .insert({
          id: fileId,
          user_id: user.id,
          folder_id: typeof folderId === "string" && folderId !== "null" && folderId !== ""
            ? folderId
            : null,
          name: file.name,
          original_name: file.name,
          size: file.size,
          type: getFileType(file.name, file.type || "application/octet-stream"),
          mime_type: file.type || "application/octet-stream",
          path: uploadResult.path,
          url: uploadResult.url,
          s3_key: uploadResult.s3Key,
          storage_path: uploadResult.storagePath,
          storage_type: uploadResult.storageType,
          metadata: { originalName: file.name },
        })
        .select("*")
        .single();

      if (error) {
        await deleteFromStorage(
          uploadResult.storageType,
          config,
          uploadResult.path,
          uploadResult.s3Key,
          uploadResult.storagePath,
        );
        throw error;
      }

      uploadedFiles.push(data);
    }

    return jsonResponse({ success: true, data: uploadedFiles });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("knowledge-file-storage error:", error);
    return jsonResponse({ success: false, message }, 500);
  }
});
