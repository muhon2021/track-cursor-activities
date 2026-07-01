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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    // Parse optional limit from request body (cron jobs send no body)
    let limit = 10
    try {
      const body = await req.json()
      if (body?.limit && typeof body.limit === 'number') {
        limit = body.limit
      }
    } catch {
      // No body provided (cron invocation) — use default limit
    }

    // Fetch meetings where status='completed' and ai_summary IS NULL
    const { data: pendingMeetings, error: fetchError } = await supabaseClient
      .from('meetings')
      .select('id, title, description')
      .eq('status', 'completed')
      .is('summary', null)
      .limit(limit)

    if (fetchError) {
      console.error('Error fetching pending meetings:', fetchError)
      throw new Error(`Failed to fetch pending meetings: ${fetchError.message}`)
    }

    if (!pendingMeetings || pendingMeetings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, errors: 0, message: 'No pending meetings to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`Found ${pendingMeetings.length} pending meetings to process`)

    let processedCount = 0
    let errorCount = 0

    for (const meeting of pendingMeetings) {
      try {
        console.log(`Processing meeting ${meeting.id}: ${meeting.title}`)

        // Step 1: Check if transcript exists in meeting_transcripts
        const { data: transcript } = await supabaseClient
          .from('meeting_transcripts')
          .select('id, content')
          .eq('meeting_id', meeting.id)
          .maybeSingle()

        if (!transcript?.content) {
          console.log(`No transcript found for meeting ${meeting.id}, skipping`)
          continue
        }

        // Step 2: Call generate-meeting-summary-v2
        try {
          const summaryResponse = await fetch(
            `${supabaseUrl}/functions/v1/generate-meeting-summary-v2`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({ meeting_id: meeting.id, force: false }),
            }
          )

          if (!summaryResponse.ok) {
            const errorText = await summaryResponse.text()
            console.error(`Summary generation failed for meeting ${meeting.id}:`, errorText)
          } else {
            console.log(`Summary generated for meeting ${meeting.id}`)
          }
        } catch (summaryError) {
          console.error(`Error calling generate-meeting-summary-v2 for meeting ${meeting.id}:`, summaryError)
        }

        // Step 3: Call categorize-meeting
        try {
          const categorizeResponse = await fetch(
            `${supabaseUrl}/functions/v1/categorize-meeting`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                meeting_id: meeting.id,
                meeting_title: meeting.title,
                meeting_description: meeting.description,
              }),
            }
          )

          if (!categorizeResponse.ok) {
            const errorText = await categorizeResponse.text()
            console.error(`Categorization failed for meeting ${meeting.id}:`, errorText)
          } else {
            console.log(`Categorization completed for meeting ${meeting.id}`)
          }
        } catch (categorizeError) {
          console.error(`Error calling categorize-meeting for meeting ${meeting.id}:`, categorizeError)
        }

        // Step 4: Call parse-meeting-action-items
        try {
          const actionItemsResponse = await fetch(
            `${supabaseUrl}/functions/v1/parse-meeting-action-items`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({ meeting_id: meeting.id }),
            }
          )

          if (!actionItemsResponse.ok) {
            const errorText = await actionItemsResponse.text()
            console.error(`Action items parsing failed for meeting ${meeting.id}:`, errorText)
          } else {
            console.log(`Action items parsed for meeting ${meeting.id}`)
          }
        } catch (actionError) {
          console.error(`Error calling parse-meeting-action-items for meeting ${meeting.id}:`, actionError)
        }

        // Step 5: Update meeting embedding_status to 'processing'
        const { error: updateError } = await supabaseClient
          .from('meetings')
          .update({ metadata: { embedding_status: 'processing' } })
          .eq('id', meeting.id)

        if (updateError) {
          console.error(`Error updating embedding status for meeting ${meeting.id}:`, updateError)
        }

        processedCount++
        console.log(`Successfully processed meeting ${meeting.id}`)

        // Delay 500ms between meetings to avoid rate limits
        if (pendingMeetings.indexOf(meeting) < pendingMeetings.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      } catch (meetingError) {
        console.error(`Error processing meeting ${meeting.id}:`, meetingError)
        errorCount++
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: processedCount, errors: errorCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Process pending meetings error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
