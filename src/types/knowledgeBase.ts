/**
 * Knowledge Base & Personal Knowledge shared types
 */

export type OwnerType = 'user' | 'project' | 'client' | 'deal' | 'common';

export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface UnifiedDocument {
  id: string;
  owner_type: OwnerType;
  owner_id: string;
  source_id: string | null;
  title: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  drive_file_id: string | null;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  chunk_count: number;
  embedding_model: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string | null;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  sort_order: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseSource {
  id: string;
  name: string;
  slug?: string;
  source_type: string;
  config?: Record<string, unknown>;
  is_active?: boolean;
  last_synced_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseFile {
  id: string;
  category_id: string | null;
  source_id: string | null;
  title: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  chunk_count: number;
  embedding_model: string | null;
  metadata: Record<string, unknown>;
  uploaded_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SemanticSearchResult {
  id: string;
  entity_type: string;
  entity_id: string;
  content: string;
  metadata: Record<string, unknown>;
  user_id: string | null;
  similarity: number;
  unified_document_id?: string | null;
}

export interface KnowledgeBaseStats {
  totalCategories: number;
  totalFiles: number;
  totalSources: number;
}

export interface UserKnowledgeStats {
  total_files: number;
  total_size: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  by_source?: Record<string, number>;
}

export interface UserAgentPersonalization {
  id: string;
  user_id: string;
  agent_id: string;
  is_enabled: boolean;
  additional_prompt: string | null;
  attached_knowledge_files: string[];
  attached_unified_document_ids?: string[];
  use_all_knowledge: boolean;
  max_context_files: number;
  relevance_threshold: number;
  created_at: string;
  updated_at: string;
}
