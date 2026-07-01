# Knowledgebase Implementation Guide

Use this guide to recreate the Knowledge Base feature in another project. The current project implements it as a file/folder management module backed by authenticated API routes, Supabase tables, local or S3 storage, and optional RAG/OpenAI integration.

## Feature Scope

The Knowledge Base lets an authenticated user:

- Create, edit, list, and delete folders.
- Upload one or more files to the root or a selected folder.
- List files by root or folder, with pagination/search support from the API.
- Move files between folders.
- Rename, star, delete, download, or stream files.
- Share folders or files with other users using `sharedWith` entries.
- View files shared directly with them and files inherited from shared folders.
- Detect duplicate uploads on the client and resolve by overwrite, version, or skip.
- Store files locally or in S3, while recording the active storage backend per file.
- Connect knowledge files to agent/project/RAG workflows by storing stable file IDs.

## Source Structure In This Project

Frontend module:

```text
client/src/modules/files/
  api/file.ts
  components/FilesSkeleton.tsx
  pages/FilesPage.tsx
  index.ts
```

Shared frontend dependencies used by the page:

```text
client/src/components/files/
  AddFilesDialog.tsx
  CreateFolderDialog.tsx
  EditFolderDialog.tsx
  FolderBreadcrumb.tsx
  MoveFileDialog.tsx
  ManageAccessDialog.tsx
  RenameFileDialog.tsx
  DuplicateResolutionDialog.tsx
  KeyboardShortcutsDialog.tsx
  SharedWithMeBadge.tsx

client/src/utils/duplicateHandler.ts
client/src/services/s3Service.ts
client/src/config/api.ts
client/src/context/AuthContext.tsx
client/src/hooks/use-toast.ts
client/src/hooks/useKeyboardShortcuts.ts
```

Backend module:

```text
server/src/modules/knowledge/
  routes/KnowledgeRoutes.js
  controllers/KnowledgeController.js
  services/KnowledgeService.js
  repositories/FileRepository.js
  repositories/FolderRepository.js
  middlewares/knowledgeValidation.js
  constants/validationConstants.js
  constants/errorCodes.js
```

Storage/RAG integrations:

```text
server/src/shared/config/s3Config.js
server/src/shared/constants/index.js
server/src/api/index.js
server/src/modules/rag/controllers/RagController.js
server/src/modules/agents/controllers/AgentFileController.js
server/src/modules/projects/controllers/ProjectFileUploadController.js
```

## Data Model

Use Supabase/Postgres as the target design. The project also has legacy Mongoose models, but the active repositories use Supabase tables named `folders` and `files`.

### `folders`

Required columns:

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid not null references users(id),
name text not null,
color text not null default '#6b7280',
is_public boolean not null default false,
is_shared boolean not null default false,
size bigint not null default 0,
file_count integer not null default 0,
shared_with jsonb not null default '[]'::jsonb,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
deleted_at timestamptz null
```

Indexes:

```sql
create unique index if not exists folders_name_user_id_unique
on folders (user_id, lower(name));

create index if not exists idx_folders_user_created
on folders (user_id, created_at desc);

create index if not exists idx_folders_shared_with
on folders using gin (shared_with);
```

### `files`

Required columns:

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid not null references users(id),
folder_id uuid null references folders(id) on delete set null,
name text not null,
original_name text not null,
size bigint not null default 0,
type text not null,
mime_type text not null,
path text not null,
url text not null,
s3_key text null,
storage_type text not null default 'local' check (storage_type in ('local', 's3')),
is_public boolean not null default false,
is_shared boolean not null default false,
is_starred boolean not null default false,
metadata jsonb not null default '{}'::jsonb,
openai jsonb null,
shared_with jsonb not null default '[]'::jsonb,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
deleted_at timestamptz null
```

Indexes:

```sql
create index if not exists idx_files_user_created
on files (user_id, created_at desc);

create index if not exists idx_files_user_folder
on files (user_id, folder_id);

create index if not exists idx_files_user_type
on files (user_id, type);

create index if not exists idx_files_storage_type
on files (storage_type);

create index if not exists idx_files_shared_with
on files using gin (shared_with);
```

### Shared User Shape

Store sharing entries as JSON objects:

```ts
export interface SharedUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  permissions: 'read' | 'write';
  addedAt?: string;
  excluded?: boolean;
}
```

Folder sharing grants access to files in that folder. Direct file sharing takes precedence. If a shared user deletes a shared file/folder, remove only that user's access instead of deleting the owner record.

## Backend Contract

Mount the module under `/api/knowledge`.

### Folder Endpoints

```text
GET    /api/knowledge/folders
GET    /api/knowledge/folders/:id
POST   /api/knowledge/folders
PUT    /api/knowledge/folders/:id
DELETE /api/knowledge/folders/:id
GET    /api/knowledge/folders/:folderId/files
```

Create folder request:

```json
{
  "name": "Product Docs",
  "color": "#6b7280",
  "isPublic": false,
  "isShared": false
}
```

Update folder request:

```json
{
  "name": "Product Docs",
  "color": "#3b82f6",
  "sharedWith": [
    {
      "id": "user-id",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "permissions": "read"
    }
  ]
}
```

### File Endpoints

```text
GET    /api/knowledge/files?page=1&limit=1000&search=&folderId=&type=
GET    /api/knowledge/files/statistics
GET    /api/knowledge/files/:id
POST   /api/knowledge/files
GET    /api/knowledge/files/:id/download
GET    /api/knowledge/files/:id/stream
PUT    /api/knowledge/files/:id
DELETE /api/knowledge/files/:id
POST   /api/knowledge/files/bulk-delete
POST   /api/knowledge/files/bulk-toggle-public
POST   /api/knowledge/files/bulk-toggle-shared
```

Upload request is `multipart/form-data`:

```text
files: File[]
folderId: string | ""   # empty string means root
isPublic: boolean
isShared: boolean
```

Important upload behavior:

- Use `multer.array('files', 20)`.
- Limit each file to 50 MB by default.
- Save local files under `<UPLOAD_PATH or cwd/uploads>/knowledgebase/<userId>/`.
- First write a temporary multer file, create the DB record, then rename the physical file to `<fileId><extension>`.
- Store `url` as `/uploads/knowledgebase/<userId>/<fileId><extension>`.
- If `STORAGE_TYPE=s3`, upload to S3 and update the file row with `s3_key`, S3 URL/path metadata, and `storage_type='s3'`.

Common response shape:

```ts
export interface ApiSuccess<TData> {
  success: true;
  data: TData;
  message: string;
}

export interface PaginatedResponse<TItem> {
  success: true;
  data: TItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message: string;
}
```

For upload, return `{ file }` for one file and `{ files }` for multiple files.

## File Type Rules

Use MIME type as the backend source of truth. A practical discriminated union for TypeScript projects:

```ts
export type KnowledgeFileType =
  | 'document'
  | 'image'
  | 'audio'
  | 'video'
  | 'archive'
  | 'code'
  | 'other';
```

Supported MIME examples:

```text
text/plain, text/markdown, text/csv, text/html, text/css, text/javascript
application/json, application/xml, application/pdf, application/msword
application/vnd.openxmlformats-officedocument.wordprocessingml.document
application/vnd.ms-excel
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
application/vnd.ms-powerpoint
application/vnd.openxmlformats-officedocument.presentationml.presentation
image/jpeg, image/png, image/gif, image/webp, image/svg+xml
audio/mpeg, audio/wav, video/mp4, video/webm
application/zip, application/x-rar-compressed, application/x-7z-compressed
```

## Frontend Contract

Create a module with these types. Avoid `any`; use `unknown` when parsing uncertain API responses.

```ts
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
  modified: string;
  isStarred: boolean;
  usedIn: string[];
  folderId: string | null;
  sharedWith: SharedUser[];
  uploadedAt: Date;
  storageType?: 'local' | 's3';
  userId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerAvatar?: string;
}
```

API wrapper functions:

```text
createFolder(name, color)
listFolders()
updateFolder(id, data)
deleteFolder(id)
uploadFiles(files, folderId, onProgress?)
listFiles(folderId?)
updateFile(id, data)
deleteFile(id)
```

Page state:

```text
folders, files
currentFolder
searchTerm
folderViewMode: grid | list
fileViewMode: grid | list
loadingFolders, loadingFiles, loadingStorage
dialog state for create/edit/upload/move/share/rename/delete/duplicates/keyboard shortcuts
```

Required UI behavior:

- Root view shows folders and files where `folderId` is `null`.
- Folder view shows only files whose normalized `folderId` matches `currentFolder`.
- Breadcrumb goes from `Home` to selected folder.
- Search filters current visible folders/files client-side.
- Folder and file operations use optimistic UI updates, with rollback and toast on failure.
- Owner-only actions include edit, delete, move, and manage access.
- Shared items show a "Shared with me" badge and owner details when available.
- Files from a different storage backend should be visually muted and actions disabled.
- Keyboard shortcuts: `Ctrl+N` create folder, `Ctrl+U` upload, `Ctrl+F` focus search, `Shift+?` shortcuts, `Escape` close dialogs.

## Duplicate Upload Handling

Before upload, compare selected files with files visible in the target folder by case-insensitive name.

Resolution strategies:

- `overwrite`: delete the existing file, then upload the new one with the same name.
- `version`: create a new `File` object with a generated name like `document (1).pdf`.
- `skip`: do not upload that file.

Keep this logic on the client because it depends on current folder UI state and user choice.

## Access And Ownership Rules

Use `req.user.id` from authentication for all folder/file reads and writes.

Folder listing should return:

- Folders where `folders.user_id = currentUserId`.
- Folders where `shared_with` contains `{ id: currentUserId }`.

File listing should return:

- Owned files in the requested folder/root.
- Directly shared files where `files.shared_with` contains `{ id: currentUserId }`.
- Files inside folders shared with the user.

When mutating:

- Owners can update/delete their own folders/files.
- Users with shared `write` permission may update shared records.
- Shared users deleting an item should remove their own `shared_with` entry, not delete the owner's record.

## Storage Rules

Local storage:

```text
UPLOAD_PATH or process.cwd()/uploads
uploads/knowledgebase/<userId>/<fileId>.<ext>
```

S3 storage:

```text
knowledgebase/<userId>/<fileId>.<ext>
```

Keep `storage_type` on every file. When the active app storage is S3, verify S3 objects exist before showing S3 files. When the active app storage is local, local files can still be listed, but the UI may mute files from the inactive backend.

## RAG Or Agent Integration

The Knowledge Base is the source of stable file records. Other modules should connect to files by ID instead of re-uploading blindly.

Typical flow:

```text
1. User uploads files to Knowledge Base.
2. User selects knowledge file IDs for an agent/project.
3. Backend fetches those IDs through FileRepository.findByIds(fileIds, userId).
4. Backend resolves local path or downloads from S3.
5. Backend sends the physical file to OpenAI/vector store/RAG ingestion.
6. Agent/project stores references such as knowledgeConfig.file_ids or knowledgeBaseId.
```

Useful RAG endpoint shape:

```text
POST /api/rag/agents/:agentId/upload-knowledge-files
body: { fileIds: string[], useDoclingParse?: boolean }
```

## Implementation Checklist For Another Project

1. Add database migrations for `folders` and `files`.
2. Add authenticated `/api/knowledge` routes.
3. Add upload middleware with file size, file count, MIME type, and friendly error handling.
4. Add repository methods for owned records, shared records, folder files, bulk updates, and statistics.
5. Add service methods for validation, ownership/share access, upload, move, delete, S3 update, and owner enrichment.
6. Add a strict typed frontend API wrapper.
7. Add the page, dialogs, skeletons, duplicate handler, and keyboard shortcuts.
8. Add storage settings support so the UI can display `local` vs `s3`.
9. Add optional RAG/agent connector that consumes existing knowledge file IDs.
10. Test folder CRUD, root uploads, folder uploads, moving, sharing, duplicate resolution, local storage, S3 storage, and delete cleanup.

## Cursor Prompt For The Target Project

Copy this prompt into Cursor in the target project:

```text
Implement a Knowledge Base feature using this guide as the source of truth.

Requirements:
- Use strict TypeScript on the frontend. Do not use any. Use unknown for uncertain API payloads and narrow them.
- Use explicit return types for all functions.
- Prefer interfaces for object shapes.
- Use string literal unions instead of enums.
- Follow the target project's existing API client, auth, toast, UI, and routing patterns.

Feature:
- Authenticated users can manage knowledge folders and files.
- Folders support name, color, owner, size, file count, and shared users.
- Files support folder assignment, MIME-derived type, size, path/url, local/S3 storage metadata, star state, OpenAI/RAG metadata, and shared users.
- Root files have folderId null.
- File upload uses multipart field name files and optional folderId.
- Implement list/create/update/delete folders, list/upload/update/delete/download/stream files, bulk file operations, sharing, duplicate upload resolution, and optional RAG connection by file IDs.

Backend:
- Add /api/knowledge routes as described in the guide.
- Add folders and files tables/migrations if missing.
- Store uploads under uploads/knowledgebase/<userId>/<fileId>.<ext> for local storage.
- Support STORAGE_TYPE local or s3, and record storage_type on each file.
- Return success/data/message responses and paginated responses for list files.
- Enforce owner/shared access rules.

Frontend:
- Add a Knowledge Base page with root/folder navigation, grid/list views, search, create folder, add files, edit folder, move file, manage access, rename, star, delete, duplicate resolution, skeleton loading, storage badge, and keyboard shortcuts.
- Build typed API functions for the knowledge endpoints.
- Normalize server id/_id and snake_case/camelCase fields at the API boundary.

Before editing, inspect the target project's existing architecture and reuse its local patterns.
After implementation, run typecheck/lint/tests available in the target project.
```

