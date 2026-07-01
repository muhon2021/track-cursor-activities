/**
 * entity-content-resolver
 *
 * Resolves an entity reference to text content for embedding.
 * Returns parsed_documents.markdown when available (structured parse),
 * otherwise falls back to raw file download.
 *
 * Fixes from original:
 * - Storage bucket: 'knowledge' → 'knowledge-files'
 * - Adds parsed_documents fallback for knowledge_file and unified_document
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface EntityContentResult {
  content: string
  metadata?: Record<string, unknown>
  user_id?: string | null
  source_id?: string | null
  unified_document_id?: string | null
}

async function getParsedMarkdown(
  supabase: SupabaseClient,
  source_type: string,
  source_id: string
): Promise<string | null> {
  const { data } = await supabase
    .from('parsed_documents')
    .select('id, parse_status, parse_version')
    .eq('source_type', source_type)
    .eq('source_id', source_id)
    .eq('parse_status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  // Return a reference to the parsed document — callers can fetch pages
  // For now we reconstruct from document_pages
  const { data: pages } = await supabase
    .from('document_pages')
    .select('page_number, content')
    .eq('document_id', data.id)
    .order('page_number')

  if (!pages || pages.length === 0) return null

  return pages.map((p) => p.content).join('\n\n')
}

export async function resolveEntityContent(
  supabase: SupabaseClient,
  entity_type: string,
  entity_id: string
): Promise<EntityContentResult | null> {
  switch (entity_type) {
    case 'knowledge_entry': {
      const { data } = await supabase
        .from('knowledge_entries')
        .select('id, title, content, summary, created_by')
        .eq('id', entity_id)
        .maybeSingle()
      if (!data?.content) return null
      const text = `# ${data.title}\n\n${data.summary ? data.summary + '\n\n' : ''}${data.content}`
      return { content: text, metadata: { title: data.title }, user_id: data.created_by }
    }

    case 'knowledge_file': {
      const { data } = await supabase
        .from('knowledge_files')
        .select('id, title, file_name, storage_path, uploaded_by, source_id, metadata')
        .eq('id', entity_id)
        .maybeSingle()
      if (!data?.storage_path) return null

      // Prefer structured parsed content when available
      const parsedMarkdown = await getParsedMarkdown(supabase, 'knowledge_file', entity_id)
      if (parsedMarkdown) {
        return {
          content: parsedMarkdown,
          metadata: { title: data.title, file_name: data.file_name, source: 'parsed_documents' },
          user_id: data.uploaded_by,
          source_id: data.source_id,
        }
      }

      // Fallback: raw download — bucket fixed from 'knowledge' → 'knowledge-files'
      const { data: fileData } = await supabase.storage.from('knowledge-files').download(data.storage_path)
      if (!fileData) return null
      const content = await fileData.text()
      return {
        content: `# ${data.title || data.file_name}\n\n${content}`,
        metadata: { title: data.title, file_name: data.file_name },
        user_id: data.uploaded_by,
        source_id: data.source_id,
      }
    }

    case 'unified_document': {
      const { data } = await supabase
        .from('unified_documents')
        .select('id, title, content, user_id, owner_id, metadata, storage_path')
        .eq('id', entity_id)
        .maybeSingle()
      if (!data) return null

      // Prefer structured parsed content
      const parsedMarkdown = await getParsedMarkdown(supabase, 'unified_document', entity_id)
      if (parsedMarkdown) {
        return {
          content: `# ${data.title}\n\n${parsedMarkdown}`,
          metadata: { title: data.title, source: 'parsed_documents' },
          user_id: data.user_id ?? data.owner_id,
          unified_document_id: data.id,
        }
      }

      // Fallback: inline content field
      const content = data.content || (data.metadata as Record<string, string>)?.extracted_text || ''
      if (!content) return null
      return {
        content: `# ${data.title}\n\n${content}`,
        metadata: { title: data.title },
        user_id: data.user_id ?? data.owner_id,
        unified_document_id: data.id,
      }
    }

    case 'user_knowledge_file': {
      const { data } = await supabase
        .from('user_knowledge_files')
        .select('id, file_name, storage_path, user_id')
        .eq('id', entity_id)
        .maybeSingle()
      if (!data?.storage_path) return null

      const parsedMarkdown = await getParsedMarkdown(supabase, 'user_knowledge_file', entity_id)
      if (parsedMarkdown) {
        return {
          content: parsedMarkdown,
          metadata: { file_name: data.file_name, source: 'parsed_documents' },
          user_id: data.user_id,
        }
      }

      const { data: fileData } = await supabase.storage.from('user-knowledge').download(data.storage_path)
      if (!fileData) return null
      const content = await fileData.text()
      return {
        content: `# ${data.file_name}\n\n${content}`,
        metadata: { file_name: data.file_name },
        user_id: data.user_id,
      }
    }

    default:
      return null
  }
}
