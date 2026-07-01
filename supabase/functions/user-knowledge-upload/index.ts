import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const formData = await req.formData()
    const sourceId = formData.get('source_id')
    const userId = formData.get('user_id')
    const files = formData.getAll('files')

    if (!sourceId || !userId) {
      return new Response(
        JSON.stringify({ error: 'source_id and user_id are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const uploadedFiles = []

    for (const file of files) {
      if (file instanceof File) {
        // Generate unique file path
        const fileName = file.name
        const filePath = `${userId}/${sourceId}/${Date.now()}_${fileName}`

        // Upload to Supabase Storage
        const { data: storageData, error: storageError } = await supabaseClient.storage
          .from('user-knowledge')
          .upload(filePath, file)

        if (storageError) {
          console.error('Storage upload error:', storageError)
          continue
        }

        // Create unified_documents row (owner_type = 'user')
        const { data: unifiedData, error: unifiedError } = await supabaseClient
          .from('unified_documents')
          .insert([{
            owner_type: 'user',
            owner_id: userId,
            source_id: sourceId || null,
            title: fileName,
            file_name: fileName,
            file_type: file.type,
            file_size: file.size,
            storage_path: filePath,
            processing_status: 'pending',
            metadata: {
              original_name: fileName,
              uploaded_at: new Date().toISOString(),
              source_id: sourceId,
            },
          }])
          .select()
          .single()

        if (!unifiedError && unifiedData) {
          uploadedFiles.push(unifiedData)
        } else {
          // Fallback: user_knowledge_files if unified_documents insert fails
          const { data: dbData, error: dbError } = await supabaseClient
            .from('user_knowledge_files')
            .insert([{
              user_id: userId,
              source_id: sourceId,
              source_type: 'upload',
              file_name: fileName,
              file_path: filePath,
              file_size: file.size,
              mime_type: file.type,
              processing_status: 'pending',
              metadata: {
                original_name: fileName,
                uploaded_at: new Date().toISOString(),
              },
            }])
            .select()
            .single()
          if (!dbError && dbData) {
            uploadedFiles.push(dbData)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        uploaded_files: uploadedFiles,
        count: uploadedFiles.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('User knowledge upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
