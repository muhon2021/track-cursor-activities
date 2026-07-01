import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendEmailRequest {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  bodyHtml?: string
  contactId?: string
  activityId?: string
  enableTracking?: boolean
  fromEmail?: string
  fromName?: string
  replyTo?: string
  template?: {
    id: string
    variables?: Record<string, string>
  }
  schedule?: {
    sendAt: string
  }
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
  reply_to?: { email: string }
  tracking_settings?: {
    open_tracking?: { enabled: boolean }
    click_tracking?: { enabled: boolean }
  }
  custom_args?: Record<string, string>
}

async function addTrackingToEmail(
  bodyHtml: string,
  trackingPixelId: string,
  trackingBaseUrl: string,
  enableTracking: boolean
): Promise<string> {
  if (!enableTracking || !trackingPixelId) {
    return bodyHtml
  }

  // Add tracking pixel
  const trackingPixel = `<img src="${trackingBaseUrl}/pixel/${trackingPixelId}" width="1" height="1" alt="" style="display:none;" />`

  // Wrap links with click tracking (simplified - in production use more robust parsing)
  let trackedHtml = bodyHtml.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (match, url) => {
      const encodedUrl = encodeURIComponent(url)
      return `href="${trackingBaseUrl}/click/${trackingPixelId}?url=${encodedUrl}"`
    }
  )

  // Append tracking pixel before closing body tag
  trackedHtml = trackedHtml.replace('</body>', `${trackingPixel}</body>`)

  return trackedHtml
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: SendEmailRequest = await req.json()
    const {
      to,
      cc,
      bcc,
      subject,
      body: bodyText,
      bodyHtml,
      contactId,
      activityId,
      enableTracking = true,
      fromEmail,
      fromName,
      replyTo,
      template,
      schedule
    } = body

    // Validate required fields
    if (!to || to.length === 0 || !subject || (!bodyText && !bodyHtml)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, and body or bodyHtml' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const TRACKING_BASE_URL = Deno.env.get('EMAIL_TRACKING_BASE_URL') || `${new URL(req.url).origin}/email-tracking`

    if (!SENDGRID_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'SENDGRID_API_KEY not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      )
    }

    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

    // Get SendGrid config from database
    let fromConfig = { email: fromEmail || 'noreply@sjinnovation.com', name: fromName || 'SJ Innovation' }
    let trackingConfig = { openTracking: enableTracking, clickTracking: enableTracking }

    if (supabase) {
      try {
        const { data: config } = await supabase
          .from('sendgrid_config')
          .select('*')
          .limit(1)
          .single()

        if (config) {
          fromConfig = {
            email: fromEmail || config.from_email,
            name: fromName || config.from_name
          }
          trackingConfig = {
            openTracking: config.enable_open_tracking,
            clickTracking: config.enable_click_tracking
          }
        }
      } catch {
        // Use defaults if config fetch fails
      }
    }

    const trackingPixelId = crypto.randomUUID()
    let finalBodyHtml = bodyHtml || `<p>${bodyText?.replace(/\n/g, '<br>')}</p>`

    // Add tracking if enabled
    if (trackingConfig.openTracking) {
      finalBodyHtml = await addTrackingToEmail(
        finalBodyHtml,
        trackingPixelId,
        TRACKING_BASE_URL,
        true
      )
    }

    // Build SendGrid request
    const sendGridRequest: SendGridRequest = {
      personalizations: [
        {
          to: to.map(email => ({ email })),
          cc: cc?.map(email => ({ email })),
          bcc: bcc?.map(email => ({ email }))
        }
      ],
      from: fromConfig as any,
      subject,
      content: [
        { type: 'text/html', value: finalBodyHtml },
        { type: 'text/plain', value: bodyText || '' }
      ],
      ...(replyTo && { reply_to: { email: replyTo } }),
      tracking_settings: {
        open_tracking: { enabled: trackingConfig.openTracking },
        click_tracking: { enabled: trackingConfig.clickTracking }
      },
      custom_args: {
        contact_id: contactId || '',
        tracking_id: trackingPixelId,
      }
    }

    // If scheduling, log to database instead of sending
    if (schedule && supabase) {
      const { error: dbError } = await supabase
        .from('email_logs')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id || crypto.randomUUID(),
          contact_id: contactId,
          recipient: to.join(','),
          cc: cc?.join(','),
          bcc: bcc?.join(','),
          subject,
          body_html: finalBodyHtml,
          body_text: bodyText,
          status: 'scheduled',
          scheduled_for: schedule.sendAt,
          provider: 'sendgrid',
          metadata: {
            tracking_id: trackingPixelId,
            from_email: fromConfig.email,
            from_name: fromConfig.name,
            reply_to: replyTo
          }
        })

      if (dbError) {
        throw new Error(`Failed to schedule email: ${dbError.message}`)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email scheduled successfully',
          scheduled_for: schedule.sendAt,
          tracking_id: trackingPixelId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Send email immediately
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendGridRequest),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`SendGrid error: ${errorData}`)
    }

    const messageId = response.headers.get('x-message-id') || trackingPixelId

    // Log to database if contact provided
    if (contactId && supabase) {
      try {
        await supabase
          .from('email_logs')
          .insert({
            user_id: (await supabase.auth.getUser()).data.user?.id || crypto.randomUUID(),
            contact_id: contactId,
            recipient: to.join(','),
            cc: cc?.join(','),
            bcc: bcc?.join(','),
            subject,
            body_html: finalBodyHtml,
            body_text: bodyText,
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider: 'sendgrid',
            provider_message_id: messageId,
            metadata: {
              tracking_id: trackingPixelId,
              from_email: fromConfig.email,
              from_name: fromConfig.name,
              reply_to: replyTo
            }
          })
      } catch (err) {
        console.error('Failed to log email:', err)
      }

      // Log activity if contact and activity tracking enabled
      try {
        await supabase
          .from('contact_activities')
          .insert({
            contact_id: contactId,
            activity_type: 'email_sent',
            channel: 'email',
            direction: 'outbound',
            subject,
            description: bodyText?.substring(0, 500),
            email_to: to,
            email_cc: cc,
            email_bcc: bcc,
            email_body: finalBodyHtml,
            email_sent_at: new Date().toISOString(),
            metadata: {
              provider_message_id: messageId,
              tracking_id: trackingPixelId
            }
          })
      } catch (err) {
        console.error('Failed to log activity:', err)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        provider_message_id: messageId,
        tracking_id: trackingPixelId,
        tracking_enabled: trackingConfig.openTracking
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Send email error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
