import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Transparent 1x1 GIF pixel
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x0a,
  0x00, 0x01, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x4c, 0x01, 0x00, 0x3b
])

async function logTrackingEvent(
  supabase: any,
  trackingId: string,
  eventType: string,
  clickedUrl?: string,
  userAgent?: string,
  ipAddress?: string
) {
  try {
    // Find the email log by tracking ID (stored in metadata)
    const { data: emailLogs, error: findError } = await supabase
      .from('email_logs')
      .select('id, contact_id')
      .like('metadata->tracking_id', `%${trackingId}%`)
      .limit(1)

    if (findError || !emailLogs || emailLogs.length === 0) {
      console.error('Email log not found for tracking ID:', trackingId)
      return
    }

    const emailLog = emailLogs[0]

    // Use the process_sendgrid_event function to create tracking event
    const { error: eventError } = await supabase.rpc('process_sendgrid_event', {
      p_event_type: eventType,
      p_sendgrid_message_id: trackingId,
      p_contact_id: emailLog.contact_id,
      p_clicked_url: clickedUrl,
      p_user_agent: userAgent,
      p_ip_address: ipAddress,
      p_metadata: { tracked_at: new Date().toISOString() }
    })

    if (eventError) {
      console.error('Error logging tracking event:', eventError)
    }
  } catch (error) {
    console.error('Error in logTrackingEvent:', error)
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const pathname = url.pathname

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      return new Response('Tracking unavailable', { status: 503 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const userAgent = req.headers.get('user-agent') || undefined
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined

    // Pixel endpoint: /email-tracking/pixel/{trackingId}
    if (pathname.match(/^\/pixel\//)) {
      const trackingId = pathname.split('/').pop()
      if (trackingId) {
        await logTrackingEvent(supabase, trackingId, 'opened', undefined, userAgent, ipAddress)
      }

      // Return transparent GIF pixel
      return new Response(TRACKING_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Content-Length': TRACKING_PIXEL.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      })
    }

    // Click endpoint: /email-tracking/click/{trackingId}?url={originalUrl}
    if (pathname.match(/^\/click\//)) {
      const trackingId = pathname.split('/').pop()
      const redirectUrl = url.searchParams.get('url')

      if (trackingId) {
        await logTrackingEvent(supabase, trackingId, 'clicked', redirectUrl ?? undefined, userAgent, ipAddress)
      }

      // Redirect to original URL if provided
      if (redirectUrl) {
        try {
          new URL(redirectUrl) // Validate URL
          return new Response(null, {
            status: 302,
            headers: {
              'Location': redirectUrl,
            }
          })
        } catch {
          return new Response('Invalid redirect URL', { status: 400 })
        }
      }

      return new Response('OK', { status: 200 })
    }

    // Health check
    if (pathname === '/' || pathname === '') {
      return new Response(
        JSON.stringify({ success: true, message: 'Email tracking service running' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response('Not found', { status: 404 })
  } catch (error: unknown) {
    console.error('Email tracking error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
