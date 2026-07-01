import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendGridRequest {
  personalizations: Array<{
    to: Array<{ email: string; name?: string }>
    cc?: Array<{ email: string; name?: string }>
    bcc?: Array<{ email: string; name?: string }>
  }>
  from: { email: string; name?: string }
  subject: string
  content: Array<{ type: string; value: string }>
  reply_to?: { email: string; name?: string }
  tracking_settings?: {
    open_tracking?: { enabled: boolean }
    click_tracking?: { enabled: boolean }
  }
  custom_args?: Record<string, string>
}

async function sendEmailViaSendGrid(
  emailData: SendGridRequest,
  sendGridApiKey: string
): Promise<string> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sendGridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailData),
  })

  if (!response.ok) {
    const errorData = await response.text()
    throw new Error(`SendGrid error (${response.status}): ${errorData}`)
  }

  // Extract message ID from headers
  const messageId = response.headers.get('x-message-id') || crypto.randomUUID()
  return messageId
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY')

    if (!supabaseUrl || !supabaseKey || !sendGridApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required environment variables' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const now = new Date()
    const results = {
      success: true,
      total_processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Fetch scheduled emails that are due (max 50 per run)
    const { data: scheduledEmails, error: fetchError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now.toISOString())
      .limit(50)

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled emails: ${fetchError.message}`)
    }

    if (!scheduledEmails || scheduledEmails.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No scheduled emails to process',
          total_processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Process each email
    for (const email of scheduledEmails) {
      try {
        // Get SendGrid config
        const { data: config, error: configError } = await supabase
          .from('sendgrid_config')
          .select('*')
          .limit(1)
          .single()

        if (configError || !config) {
          throw new Error('SendGrid config not found')
        }

        // Parse recipients
        const toEmail = email.recipient.split(',').map((e: string) => ({
          email: e.trim(),
          name: email.recipient_name
        }))

        const ccEmails = email.cc
          ? email.cc.split(',').map((e: string) => ({ email: e.trim() }))
          : undefined

        const bccEmails = email.bcc
          ? email.bcc.split(',').map((e: string) => ({ email: e.trim() }))
          : undefined

        // Build SendGrid request
        const sendGridRequest: SendGridRequest = {
          personalizations: [
            {
              to: toEmail,
              cc: ccEmails,
              bcc: bccEmails,
            }
          ],
          from: {
            email: config.from_email,
            name: config.from_name,
          },
          subject: email.subject,
          content: [
            {
              type: email.body_html ? 'text/html' : 'text/plain',
              value: email.body_html || email.body_text,
            }
          ],
          reply_to: email.metadata?.reply_to ? { email: email.metadata.reply_to } : undefined,
          tracking_settings: {
            open_tracking: { enabled: config.enable_open_tracking },
            click_tracking: { enabled: config.enable_click_tracking },
          },
          custom_args: {
            email_log_id: email.id,
            contact_id: email.contact_id || '',
          }
        }

        // Send email
        const messageId = await sendEmailViaSendGrid(sendGridRequest, sendGridApiKey)

        // Update email log
        const { error: updateError } = await supabase
          .from('email_logs')
          .update({
            status: 'sent',
            sent_at: now.toISOString(),
            provider_message_id: messageId,
            updated_at: now.toISOString(),
          })
          .eq('id', email.id)

        if (updateError) {
          throw updateError
        }

        results.sent++
      } catch (emailError) {
        console.error(`Error processing email ${email.id}:`, emailError)
        results.failed++

        // Update email log with error
        try {
          await supabase
            .from('email_logs')
            .update({
              status: 'failed',
              error_message: emailError instanceof Error ? emailError.message : String(emailError),
              updated_at: now.toISOString(),
            })
            .eq('id', email.id)
        } catch (updateErr) {
          console.error('Failed to update error status:', updateErr)
        }

        results.errors.push(
          `Email ${email.id}: ${emailError instanceof Error ? emailError.message : String(emailError)}`
        )
      }

      results.total_processed++
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Process scheduled emails error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
