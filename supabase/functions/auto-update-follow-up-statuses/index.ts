import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const now = new Date()
    const results = {
      success: true,
      total_updated: 0,
      rules_applied: [] as any[],
      errors: [] as string[]
    }

    // Rule 1: awaiting_response + 7 days no reply -> follow_up_needed
    try {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const { data: rule1Contacts, error: rule1Error } = await supabase
        .from('contacts')
        .select('id')
        .eq('followup_status', 'awaiting_response')
        .eq('is_lead_follow_up', true)
        .lt('last_contact_date', sevenDaysAgo.toISOString())

      if (rule1Error) throw rule1Error

      if (rule1Contacts && rule1Contacts.length > 0) {
        const contactIds = rule1Contacts.map(c => c.id)
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ followup_status: 'follow_up_needed', updated_at: now.toISOString() })
          .in('id', contactIds)

        if (updateError) throw updateError

        results.rules_applied.push({
          rule: 'awaiting_response + 7 days no reply',
          contacts_updated: contactIds.length,
          contact_ids: contactIds
        })
        results.total_updated += contactIds.length
      }
    } catch (error) {
      results.errors.push(`Rule 1 error: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Rule 2: new lead + 14 days no contact -> follow_up_needed
    try {
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      const { data: rule2Contacts, error: rule2Error } = await supabase
        .from('contacts')
        .select('id')
        .eq('followup_status', 'new')
        .eq('is_lead_follow_up', true)
        .or(`last_contact_date.is.null,last_contact_date.lt.${fourteenDaysAgo.toISOString()}`)

      if (rule2Error) throw rule2Error

      if (rule2Contacts && rule2Contacts.length > 0) {
        const contactIds = rule2Contacts.map(c => c.id)
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ followup_status: 'follow_up_needed', updated_at: now.toISOString() })
          .in('id', contactIds)

        if (updateError) throw updateError

        results.rules_applied.push({
          rule: 'new lead + 14 days no contact',
          contacts_updated: contactIds.length,
          contact_ids: contactIds
        })
        results.total_updated += contactIds.length
      }
    } catch (error) {
      results.errors.push(`Rule 2 error: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Rule 3: past due follow-up date + not completed -> follow_up_needed
    try {
      const { data: rule3Contacts, error: rule3Error } = await supabase
        .from('contacts')
        .select('id')
        .eq('is_lead_follow_up', true)
        .neq('followup_status', 'completed')
        .neq('followup_status', 'follow_up_needed')
        .not('next_followup_date', 'is', null)
        .lt('next_followup_date', now.toISOString())

      if (rule3Error) throw rule3Error

      if (rule3Contacts && rule3Contacts.length > 0) {
        const contactIds = rule3Contacts.map(c => c.id)
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ followup_status: 'follow_up_needed', updated_at: now.toISOString() })
          .in('id', contactIds)

        if (updateError) throw updateError

        results.rules_applied.push({
          rule: 'past due date + not completed',
          contacts_updated: contactIds.length,
          contact_ids: contactIds
        })
        results.total_updated += contactIds.length
      }
    } catch (error) {
      results.errors.push(`Rule 3 error: ${error instanceof Error ? error.message : String(error)}`)
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Auto-update status error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
