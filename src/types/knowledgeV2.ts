export type KbSearchPlatform = 'web' | 'mobile' | 'api' | 'agent' | 'slack'

export type ChunkLayoutType = 'table' | 'code' | 'list' | 'heading' | 'paragraph' | 'image'

export type HeadingSensitivity = 'low' | 'medium' | 'high'

export type CodeBlockHandling = 'preserve' | 'flatten' | 'skip'

export type OcrLanguage =
  | 'eng'
  | 'spa'
  | 'fra'
  | 'deu'
  | 'por'
  | 'jpn'
  | 'chi_sim'
  | 'auto'

export interface AdvancedParserConfig {
  table_extraction: boolean
  heading_sensitivity: HeadingSensitivity
  code_block_handling: CodeBlockHandling
  ocr_language: OcrLanguage
}

export const DEFAULT_ADVANCED_PARSER_CONFIG: AdvancedParserConfig = {
  table_extraction: true,
  heading_sensitivity: 'medium',
  code_block_handling: 'preserve',
  ocr_language: 'eng',
}

export type ConfidenceTier = 'high' | 'medium' | 'low'

export interface KbSearchResultBase {
  id: string
  content: string
  similarity: number
  rerank_score?: number
  reranked?: boolean
  metadata?: {
    entity_type?: string
    entity_id?: string
    title?: string
    chunk_index?: number
    chunk_layout_type?: ChunkLayoutType
    layout_type?: ChunkLayoutType
    [key: string]: unknown
  }
}

export interface KbUserSearchHistoryRow {
  id: string
  user_id: string
  query: string
  platform: KbSearchPlatform
  result_count: number
  created_at: string
}

export interface KbSlackChannelRow {
  id: string
  channel_id: string
  channel_name: string
  is_public: boolean
  is_enabled: boolean
  member_count: number
  last_synced_at: string | null
  sync_status: 'idle' | 'syncing' | 'completed' | 'failed'
}

export interface KbSlackSyncLedgerRow {
  id: string
  channel_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  messages_synced: number
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export interface OcrConfidenceBucket {
  range: string
  count: number
  min: number
  max: number
}

export interface MemoryDecayPoint {
  snapshot_index: number
  importance_score: number
  recorded_at: string
}
