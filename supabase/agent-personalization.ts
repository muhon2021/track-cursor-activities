/**
 * Agent Personalization Helper
 *
 * Loads and applies user-specific personalizations to AI agents:
 * - Custom prompts appended to system prompt
 * - Personal knowledge files included in context
 * - Semantic search through user's knowledge for relevant content
 * - Common/shared knowledge files support (CommonSJ/ paths)
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface UserPersonalization {
  id: string;
  user_id: string;
  agent_id: string;
  is_enabled: boolean;
  additional_prompt: string | null;
  attached_knowledge_files: string[];
  use_all_knowledge: boolean;
  max_context_files: number;
  relevance_threshold: number;
}

export interface KnowledgeContext {
  file_name: string;
  content: string;
  similarity: number;
  file_id: string;
}

export interface CommonKnowledgeFile {
  id: string;
  file_name: string;
  file_path: string;
  display_name: string | null;
  content_text: string | null;
  category: string;
  is_indexed: boolean;
}

/**
 * Load user's personalization for a specific agent
 */
export async function loadUserPersonalization(
  supabase: SupabaseClient,
  userId: string,
  agentId: string
): Promise<UserPersonalization | null> {
  const { data, error } = await supabase
    .from('user_agent_personalizations')
    .select('*')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .eq('is_enabled', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as UserPersonalization;
}

/**
 * Parse file references from additional_prompt text
 * Looks for patterns like:
 * - CommonSJ/SJInnovation.txt
 * - CommonSJ/What_is_CollabAI_.txt
 * - Anything that looks like a file path
 */
export function parseFileReferences(text: string): string[] {
  if (!text) return [];

  const fileReferences: string[] = [];
  
  // Pattern 1: CommonSJ/filename.txt or similar paths
  const pathPattern = /(?:CommonSJ|Common|Shared)\/[\w\-_\.]+\.(?:txt|md|pdf|doc|docx)/gi;
  const pathMatches = text.match(pathPattern);
  if (pathMatches) {
    fileReferences.push(...pathMatches);
  }

  // Pattern 2: Standalone filenames with common extensions
  const filePattern = /[\w\-_]+\.(?:txt|md)(?=\s|$|,|\))/gi;
  const fileMatches = text.match(filePattern);
  if (fileMatches) {
    // Filter out already matched paths
    const existingNames = new Set(fileReferences.map(f => f.split('/').pop()?.toLowerCase()));
    fileMatches.forEach(match => {
      if (!existingNames.has(match.toLowerCase())) {
        fileReferences.push(match);
      }
    });
  }

  return [...new Set(fileReferences)]; // Remove duplicates
}

/**
 * Load common knowledge files by their file paths or names
 */
export async function getCommonKnowledgeByPaths(
  supabase: SupabaseClient,
  filePaths: string[]
): Promise<KnowledgeContext[]> {
  if (filePaths.length === 0) {
    return [];
  }

  console.log(`[personalization] Looking up ${filePaths.length} common knowledge files:`, filePaths);

  // Try to match by file_path first, then by file_name
  const results: KnowledgeContext[] = [];

  for (const path of filePaths) {
    // Try exact file_path match
    let { data: file } = await supabase
      .from('common_knowledge_files')
      .select('id, file_name, file_path, content_text, is_indexed')
      .eq('file_path', path)
      .eq('is_active', true)
      .single();

    // If not found, try matching by file_name
    if (!file) {
      const fileName = path.split('/').pop() || path;
      const { data: fileByName } = await supabase
        .from('common_knowledge_files')
        .select('id, file_name, file_path, content_text, is_indexed')
        .eq('file_name', fileName)
        .eq('is_active', true)
        .single();
      file = fileByName;
    }

    // If still not found, try partial match
    if (!file) {
      const fileName = path.split('/').pop() || path;
      const { data: files } = await supabase
        .from('common_knowledge_files')
        .select('id, file_name, file_path, content_text, is_indexed')
        .ilike('file_name', `%${fileName}%`)
        .eq('is_active', true)
        .limit(1);
      
      if (files && files.length > 0) {
        file = files[0];
      }
    }

    if (file) {
      let content = file.content_text || '';

      // If file is indexed, try to get richer content from embeddings
      if (file.is_indexed) {
        const { data: embeddings } = await supabase
          .from('embeddings')
          .select('content, chunk_index')
          .eq('common_knowledge_file_id', file.id)
          .order('chunk_index');

        if (embeddings && embeddings.length > 0) {
          content = embeddings.map((e: any) => e.content).join('\n\n');
        }
      }

      if (content) {
        results.push({
          file_id: file.id,
          file_name: file.file_name,
          content: content,
          similarity: 1.0 // Direct file inclusion
        });
        console.log(`[personalization] ✓ Found common knowledge: ${file.file_path}`);
      } else {
        console.log(`[personalization] ⚠ Found file but no content: ${file.file_path}`);
      }
    } else {
      console.log(`[personalization] ✗ Common knowledge not found: ${path}`);
    }
  }

  return results;
}

/**
 * Load all active common knowledge files for a category
 */
export async function getCommonKnowledgeByCategory(
  supabase: SupabaseClient,
  category: string,
  limit: number = 5
): Promise<KnowledgeContext[]> {
  const { data: files, error } = await supabase
    .from('common_knowledge_files')
    .select('id, file_name, file_path, content_text')
    .eq('category', category)
    .eq('is_active', true)
    .limit(limit);

  if (error || !files) {
    return [];
  }

  return files
    .filter((f: any) => f.content_text)
    .map((f: any) => ({
      file_id: f.id,
      file_name: f.file_name,
      content: f.content_text,
      similarity: 1.0
    }));
}

/**
 * Search user's knowledge embeddings for relevant context
 */
export async function searchUserKnowledge(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  threshold: number = 0.7,
  limit: number = 5
): Promise<KnowledgeContext[]> {
  try {
    // First, generate embedding for the query
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.warn('[personalization] OPENAI_API_KEY not configured, skipping knowledge search');
      return [];
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!response.ok) {
      console.error('[personalization] Failed to generate query embedding');
      return [];
    }

    const embeddingResult = await response.json();
    const queryEmbedding = embeddingResult.data[0].embedding;

    // Search embeddings using vector similarity
    const { data, error } = await supabase.rpc('search_user_knowledge_embeddings', {
      p_user_id: userId,
      p_query_embedding: queryEmbedding,
      p_match_threshold: threshold,
      p_match_count: limit
    });

    if (error) {
      console.error('[personalization] Knowledge search error:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      file_id: row.file_id,
      file_name: row.file_name,
      content: row.content,
      similarity: row.similarity
    }));

  } catch (error) {
    console.error('[personalization] Exception in knowledge search:', error);
    return [];
  }
}

/**
 * Get specific knowledge files by IDs
 */
export async function getKnowledgeFilesByIds(
  supabase: SupabaseClient,
  userId: string,
  fileIds: string[]
): Promise<KnowledgeContext[]> {
  if (fileIds.length === 0) {
    return [];
  }

  // Get file metadata
  const { data: files, error: filesError } = await supabase
    .from('user_knowledge_files')
    .select('id, file_name')
    .eq('user_id', userId)
    .in('id', fileIds)
    .eq('is_indexed', true);

  if (filesError || !files) {
    console.error('[personalization] Failed to load knowledge files:', filesError);
    return [];
  }

  // Get embeddings for these files
  const { data: embeddings, error: embError } = await supabase
    .from('embeddings')
    .select('user_knowledge_file_id, content, chunk_index')
    .eq('user_id', userId)
    .in('user_knowledge_file_id', fileIds)
    .order('user_knowledge_file_id')
    .order('chunk_index');

  if (embError || !embeddings) {
    console.error('[personalization] Failed to load embeddings:', embError);
    return [];
  }

  // Group embeddings by file and combine chunks
  const fileContents: Record<string, string[]> = {};
  embeddings.forEach((emb: any) => {
    if (!fileContents[emb.user_knowledge_file_id]) {
      fileContents[emb.user_knowledge_file_id] = [];
    }
    fileContents[emb.user_knowledge_file_id].push(emb.content);
  });

  // Build context objects
  return files.map(file => ({
    file_id: file.id,
    file_name: file.file_name,
    content: fileContents[file.id]?.join('\n\n') || '',
    similarity: 1.0 // Direct file inclusion, not from search
  }));
}

/**
 * Load client knowledge documents for context
 */
export async function getClientKnowledge(
  supabase: SupabaseClient,
  clientId: string,
  limit: number = 5
): Promise<KnowledgeContext[]> {
  try {
    // Get indexed client documents
    const { data: documents, error } = await supabase
      .from('client_documents')
      .select('id, name, drive_file_id')
      .eq('client_id', clientId)
      .eq('indexing_status', 'completed')
      .is('deleted_at', null)
      .limit(limit);

    if (error || !documents || documents.length === 0) {
      return [];
    }

    // Get embeddings for these documents
    // Note: Assuming embeddings table has a client_document_id field
    const documentIds = documents.map(d => d.id);
    const { data: embeddings, error: embError } = await supabase
      .from('embeddings')
      .select('content, chunk_index, metadata')
      .in('client_document_id', documentIds)
      .order('client_document_id')
      .order('chunk_index')
      .limit(limit * 10); // Get multiple chunks per document

    if (embError || !embeddings) {
      console.error('[personalization] Failed to load client document embeddings:', embError);
      return [];
    }

    // Group embeddings by document
    const docContents: Record<string, string[]> = {};
    embeddings.forEach((emb: any) => {
      const docId = emb.metadata?.client_document_id || emb.client_document_id;
      if (!docContents[docId]) {
        docContents[docId] = [];
      }
      docContents[docId].push(emb.content);
    });

    // Build context objects
    return documents.map(doc => ({
      file_id: doc.id,
      file_name: doc.name,
      content: docContents[doc.id]?.join('\n\n') || '',
      similarity: 1.0 // Direct document inclusion
    }));

  } catch (error) {
    console.error('[personalization] Exception loading client knowledge:', error);
    return [];
  }
}

/**
 * Build enhanced context with user personalization, common knowledge, and optional client knowledge
 * @param selectedKnowledgeFileIds - Optional array of file IDs to filter knowledge context. If provided, only these files will be included.
 */
export async function buildPersonalizedContext(
  supabase: SupabaseClient,
  userId: string,
  agentId: string,
  baseSystemPrompt: string,
  query?: string,
  clientId?: string,
  selectedKnowledgeFileIds?: string[]
): Promise<{
  enhancedPrompt: string;
  knowledgeContext: KnowledgeContext[];
  clientKnowledgeContext: KnowledgeContext[];
  commonKnowledgeContext: KnowledgeContext[];
  personalization: UserPersonalization | null;
}> {
  // Load personalization
  const personalization = await loadUserPersonalization(supabase, userId, agentId);

  let knowledgeContext: KnowledgeContext[] = [];
  let clientKnowledgeContext: KnowledgeContext[] = [];
  let commonKnowledgeContext: KnowledgeContext[] = [];

  // Load client knowledge if clientId provided
  if (clientId) {
    clientKnowledgeContext = await getClientKnowledge(supabase, clientId, 3);
  }

  // Parse and load common knowledge from additional_prompt (even if no personalization)
  if (personalization?.additional_prompt) {
    const fileReferences = parseFileReferences(personalization.additional_prompt);
    if (fileReferences.length > 0) {
      console.log(`[personalization] Found ${fileReferences.length} file references in additional_prompt`);
      commonKnowledgeContext = await getCommonKnowledgeByPaths(supabase, fileReferences);
    }
  }

  if (!personalization || !personalization.is_enabled) {
    // Even without personalization, include client and common knowledge if available
    let enhancedPrompt = baseSystemPrompt;

    if (commonKnowledgeContext.length > 0) {
      enhancedPrompt += '\n\n## Company Knowledge Base:\n';
      enhancedPrompt += 'The following content is from the shared company knowledge base. Use this information in your responses:\n\n';

      commonKnowledgeContext.forEach((ctx, index) => {
        enhancedPrompt += `### ${ctx.file_name}\n`;
        enhancedPrompt += `${ctx.content}\n\n`;
      });

      enhancedPrompt += '---\n';
    }

    if (clientKnowledgeContext.length > 0) {
      enhancedPrompt += '\n\n## Client Knowledge Context:\n';
      enhancedPrompt += 'The following content is from the client\'s knowledge base:\n\n';

      clientKnowledgeContext.forEach((ctx, index) => {
        enhancedPrompt += `### Document ${index + 1}: ${ctx.file_name}\n`;
        enhancedPrompt += `${ctx.content.substring(0, 1000)}...\n\n`; // Limit content length
      });

      enhancedPrompt += '---\n';
      enhancedPrompt += 'Use the above client-specific knowledge when relevant to this communication.\n';
    }

    return {
      enhancedPrompt,
      knowledgeContext: [],
      clientKnowledgeContext,
      commonKnowledgeContext,
      personalization: null
    };
  }

  // Get knowledge files
  // Priority 1: User-selected knowledge files (from UI toggle)
  if (selectedKnowledgeFileIds && selectedKnowledgeFileIds.length > 0) {
    console.log(`[personalization] Using ${selectedKnowledgeFileIds.length} user-selected knowledge files`);
    knowledgeContext = await getKnowledgeFilesByIds(
      supabase,
      userId,
      selectedKnowledgeFileIds
    );
  }
  // Priority 2: Use all knowledge with semantic search
  else if (personalization.use_all_knowledge && query) {
    // Search all user's indexed files
    knowledgeContext = await searchUserKnowledge(
      supabase,
      userId,
      query,
      personalization.relevance_threshold,
      personalization.max_context_files
    );
  }
  // Priority 3: Use attached knowledge files from personalization
  else if (personalization.attached_knowledge_files.length > 0) {
    // Get specific attached files
    knowledgeContext = await getKnowledgeFilesByIds(
      supabase,
      userId,
      personalization.attached_knowledge_files
    );

    // If query provided, search within attached files
    if (query && knowledgeContext.length > 0) {
      const searchResults = await searchUserKnowledge(
        supabase,
        userId,
        query,
        personalization.relevance_threshold,
        personalization.max_context_files
      );

      // Filter search results to only include attached files
      const attachedFileIds = new Set(personalization.attached_knowledge_files);
      knowledgeContext = searchResults.filter(ctx =>
        attachedFileIds.has(ctx.file_id)
      );
    }
  }

  // Build enhanced prompt
  let enhancedPrompt = baseSystemPrompt;

  // Append common knowledge FIRST (company-wide context)
  if (commonKnowledgeContext.length > 0) {
    enhancedPrompt += '\n\n## Company Knowledge Base:\n';
    enhancedPrompt += 'The following content is from the shared company knowledge base. Use this information in your responses:\n\n';

    commonKnowledgeContext.forEach((ctx) => {
      enhancedPrompt += `### ${ctx.file_name}\n`;
      enhancedPrompt += `${ctx.content}\n\n`;
    });

    enhancedPrompt += '---\n';
  }

  // Append additional prompt if provided (filter out file references for cleaner prompt)
  if (personalization.additional_prompt) {
    // Clean the additional prompt - remove file path references since we've already loaded them
    let cleanedPrompt = personalization.additional_prompt;
    const fileRefs = parseFileReferences(personalization.additional_prompt);
    fileRefs.forEach(ref => {
      cleanedPrompt = cleanedPrompt.replace(ref, '').replace(/\s*-\s*$/, '');
    });
    cleanedPrompt = cleanedPrompt.replace(/\n{3,}/g, '\n\n').trim();

    if (cleanedPrompt) {
      enhancedPrompt += `\n\n## User-Specific Instructions:\n${cleanedPrompt}`;
    }
  }

  // Append user's personal knowledge context if available
  if (knowledgeContext.length > 0) {
    enhancedPrompt += '\n\n## User Personal Knowledge Context:\n';
    enhancedPrompt += 'The following content is from the user\'s personal knowledge library:\n\n';

    knowledgeContext.forEach((ctx, index) => {
      enhancedPrompt += `### Knowledge File ${index + 1}: ${ctx.file_name}\n`;
      if (ctx.similarity < 1.0) {
        enhancedPrompt += `(Relevance: ${(ctx.similarity * 100).toFixed(0)}%)\n`;
      }
      enhancedPrompt += `${ctx.content}\n\n`;
    });

    enhancedPrompt += '---\n';
    enhancedPrompt += 'Use the above knowledge to inform your response when relevant.\n';
  }

  // Append client knowledge context if available
  if (clientKnowledgeContext.length > 0) {
    enhancedPrompt += '\n\n## Client Knowledge Context:\n';
    enhancedPrompt += 'The following content is from the client\'s knowledge base:\n\n';

    clientKnowledgeContext.forEach((ctx, index) => {
      enhancedPrompt += `### Client Document ${index + 1}: ${ctx.file_name}\n`;
      // Limit content length for client docs to avoid token overflow
      const contentPreview = ctx.content.length > 1500
        ? ctx.content.substring(0, 1500) + '...[truncated]'
        : ctx.content;
      enhancedPrompt += `${contentPreview}\n\n`;
    });

    enhancedPrompt += '---\n';
    enhancedPrompt += 'Use the above client-specific knowledge to tailor your communication appropriately.\n';
  }

  return {
    enhancedPrompt,
    knowledgeContext,
    clientKnowledgeContext,
    commonKnowledgeContext,
    personalization
  };
}