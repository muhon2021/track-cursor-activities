/**
 * Knowledge Base Module Types
 */

export type { KnowledgeEntry, KnowledgeCategory } from "../hooks/useKnowledge";

export interface KnowledgeSource {
  id: string;
  name: string;
  source_type: "upload" | "google_drive" | "url" | "meeting" | "api";
  config: Record<string, unknown>;
  is_active: boolean;
  last_synced_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeFile {
  id: string;
  category_id: string | null;
  source_id: string | null;
  title: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  processing_status: "pending" | "processing" | "completed" | "failed" | "skipped";
  processing_error: string | null;
  chunk_count: number;
  embedding_model: string | null;
  metadata: Record<string, unknown>;
  uploaded_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEmbedding {
  id: string;
  file_id: string | null;
  entry_id: string | null;
  content: string;
  chunk_index: number;
  token_count: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserKnowledgeFile {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  processing_status: "pending" | "processing" | "completed" | "failed";
  chunk_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EmbeddingQueueItem {
  id: string;
  entity_type: "file" | "entry" | "meeting" | "user_file";
  entity_id: string;
  priority: number;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface VectorSearchLog {
  id: string;
  user_id: string | null;
  query: string;
  result_count: number;
  top_score: number | null;
  search_type: string;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
