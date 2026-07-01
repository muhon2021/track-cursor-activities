/**
 * AI Match Meeting Client Edge Function
 *
 * Uses AI to match a meeting to the most likely client based on
 * participant emails, meeting title/description, and historical
 * client_meetings associations.
 *
 * Input:  { meeting_id: string }
 * Output: { matched_client_id, matched_client_name, confidence, reasoning }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatCompletion, logUsage } from '../_shared/ai-provider-routing.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CONFIDENCE_HIGH = 0.80

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { meeting_id } = await req.json()

    if (!meeting_id) {
      return new Response(
        JSON.stringify({ error: 'meeting_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch meeting with title, description
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('id, title, description, client_id')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Fetch meeting participants with profile info
    const { data: participants } = await supabaseClient
      .from('meeting_participants')
      .select('user_id, email, name, role')
      .eq('meeting_id', meeting_id)

    // Also fetch external participants if available
    let externalParticipants: { external_email: string; external_name: string | null }[] = []
    try {
      const { data: extParts, error: extError } = await supabaseClient
        .from('meeting_external_participants')
        .select('external_email, external_name')
        .eq('meeting_id', meeting_id)

      if (!extError && extParts) {
        externalParticipants = extParts
      }
    } catch {
      console.log('[ai-match-meeting-client] meeting_external_participants not available')
    }

    // Fetch all clients with name, email
    const { data: clients } = await supabaseClient
      .from('clients')
      .select('id, name, email, company')

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({
          matched_client_id: null,
          matched_client_name: null,
          confidence: 0,
          reasoning: 'No clients exist in the system',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Fetch contacts associated with clients
    const { data: contacts } = await supabaseClient
      .from('contacts')
      .select('id, first_name, last_name, email, client_id')
      .not('client_id', 'is', null)

    // Fetch historical client_meetings associations for context
    let historicalAssociations: { client_id: string; meeting_count: number }[] = []
    try {
      const { data: clientMeetings, error: cmError } = await supabaseClient
        .from('client_meetings')
        .select('client_id')

      if (!cmError && clientMeetings) {
        const counts = new Map<string, number>()
        for (const cm of clientMeetings) {
          counts.set(cm.client_id, (counts.get(cm.client_id) || 0) + 1)
        }
        historicalAssociations = Array.from(counts.entries()).map(([client_id, meeting_count]) => ({
          client_id,
          meeting_count,
        }))
      }
    } catch {
      console.log('[ai-match-meeting-client] client_meetings table not available')
    }

    // Build participant info
    const participantEmails = [
      ...(participants || []).filter(p => p.email).map(p => p.email),
      ...externalParticipants.map(p => p.external_email),
    ]
    const participantNames = [
      ...(participants || []).filter(p => p.name).map(p => p.name),
      ...externalParticipants.filter(p => p.external_name).map(p => p.external_name),
    ]

    // Build client context
    const clientsList = (clients || []).map(c => {
      const clientContacts = (contacts || [])
        .filter(ct => ct.client_id === c.id)
        .map(ct => `${ct.first_name} ${ct.last_name || ''} <${ct.email || 'N/A'}>`)
        .join(', ')

      const historyEntry = historicalAssociations.find(h => h.client_id === c.id)
      const meetingHistory = historyEntry ? ` (${historyEntry.meeting_count} past meetings)` : ''

      return `- Client: "${c.name}" (id: ${c.id}, email: ${c.email || 'N/A'}, company: ${c.company || 'N/A'})${meetingHistory}${clientContacts ? `\n  Contacts: ${clientContacts}` : ''}`
    }).join('\n')

    // Call AI to match
    const result = await chatCompletion(supabaseClient, {
      messages: [
        {
          role: 'system',
          content: `You are a meeting-to-client matching assistant. Given meeting details and a list of clients with their contacts, determine which client this meeting most likely relates to.

Consider these signals (in order of strength):
1. Participant email domains matching client email/contact emails
2. Client name or company mentioned in meeting title/description
3. Contact names matching participant names
4. Historical meeting associations

Respond with a JSON object:
{
  "matched_client_id": "<UUID or null if no match>",
  "matched_client_name": "<name or null>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}

Only use client IDs from the provided list. If no client matches, set matched_client_id to null with confidence 0.`
        },
        {
          role: 'user',
          content: `Meeting Title: ${meeting.title}
Meeting Description: ${meeting.description || 'N/A'}
Participant Emails: ${participantEmails.length > 0 ? participantEmails.join(', ') : 'N/A'}
Participant Names: ${participantNames.length > 0 ? participantNames.join(', ') : 'N/A'}

Available Clients:
${clientsList}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    })

    // Parse AI response
    let matchResult = {
      matched_client_id: null as string | null,
      matched_client_name: null as string | null,
      confidence: 0,
      reasoning: 'Failed to parse AI response',
    }

    try {
      const parsed = JSON.parse(result.content)
      matchResult = {
        matched_client_id: parsed.matched_client_id || null,
        matched_client_name: parsed.matched_client_name || null,
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || '',
      }
    } catch {
      console.warn('[ai-match-meeting-client] Failed to parse AI response as JSON')
    }

    // Validate matched_client_id exists in our clients list
    if (matchResult.matched_client_id) {
      const validClient = (clients || []).find(c => c.id === matchResult.matched_client_id)
      if (!validClient) {
        console.warn('[ai-match-meeting-client] AI returned invalid client_id, discarding')
        matchResult.matched_client_id = null
        matchResult.matched_client_name = null
        matchResult.confidence = 0
        matchResult.reasoning = 'AI returned an invalid client ID'
      }
    }

    // If high confidence, auto-update meeting.client_id and insert into client_meetings
    if (matchResult.matched_client_id && matchResult.confidence >= CONFIDENCE_HIGH) {
      // Update meeting client_id
      const { error: updateError } = await supabaseClient
        .from('meetings')
        .update({ client_id: matchResult.matched_client_id })
        .eq('id', meeting_id)

      if (updateError) {
        console.error('[ai-match-meeting-client] Failed to update meeting client_id:', updateError)
      }

      // Insert into client_meetings (ignore conflict if already exists)
      const { error: linkError } = await supabaseClient
        .from('client_meetings')
        .upsert(
          {
            client_id: matchResult.matched_client_id,
            meeting_id,
          },
          { onConflict: 'client_id,meeting_id' }
        )

      if (linkError) {
        console.error('[ai-match-meeting-client] Failed to insert client_meetings:', linkError)
      }
    }

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'ai-match-meeting-client',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify(matchResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('AI match meeting client error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
