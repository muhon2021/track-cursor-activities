/**
 * Send Meeting Notification Edge Function
 *
 * Sends email notifications about meetings with timezone support.
 * Uses SendGrid when available, otherwise logs the notification
 * and returns success (graceful degradation).
 *
 * Input:  { meeting_id: string, type: 'reminder' | 'updated' | 'cancelled' | 'created', recipient_ids?: string[] }
 * Output: { success: true, notifications_sent: number, recipients: string[] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatMeetingTime(startTime: string, timezone: string): string {
  try {
    const date = new Date(startTime)
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    })
  } catch {
    // Fallback if timezone is invalid
    const date = new Date(startTime)
    return `${date.toISOString()} (${timezone})`
  }
}

function buildEmailContent(
  type: string,
  meetingTitle: string,
  formattedTime: string,
  timezone: string
): { subject: string; body: string } {
  switch (type) {
    case 'reminder':
      return {
        subject: `Meeting Reminder: ${meetingTitle} at ${formattedTime}`,
        body: `<p>This is a reminder that your meeting <strong>${meetingTitle}</strong> is scheduled for <strong>${formattedTime}</strong> (${timezone}).</p><p>Please make sure you are prepared and join on time.</p>`,
      }
    case 'updated':
      return {
        subject: `Meeting Updated: ${meetingTitle} - details changed`,
        body: `<p>The meeting <strong>${meetingTitle}</strong> has been updated.</p><p>Updated time: <strong>${formattedTime}</strong> (${timezone}).</p><p>Please review the updated meeting details.</p>`,
      }
    case 'cancelled':
      return {
        subject: `Meeting Cancelled: ${meetingTitle}`,
        body: `<p>The meeting <strong>${meetingTitle}</strong> that was scheduled for <strong>${formattedTime}</strong> (${timezone}) has been cancelled.</p>`,
      }
    case 'created':
      return {
        subject: `New Meeting: ${meetingTitle} at ${formattedTime}`,
        body: `<p>You have been invited to a new meeting: <strong>${meetingTitle}</strong>.</p><p>Scheduled for: <strong>${formattedTime}</strong> (${timezone}).</p>`,
      }
    default:
      return {
        subject: `Meeting Notification: ${meetingTitle}`,
        body: `<p>Notification about meeting <strong>${meetingTitle}</strong> scheduled for <strong>${formattedTime}</strong> (${timezone}).</p>`,
      }
  }
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

    const { meeting_id, type, recipient_ids } = await req.json()

    if (!meeting_id) {
      return new Response(
        JSON.stringify({ error: 'meeting_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!type || !['reminder', 'updated', 'cancelled', 'created'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'type must be one of: reminder, updated, cancelled, created' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch meeting details
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('id, title, start_time, timezone, description, location')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Fetch participants joined with profiles for email
    const { data: participants, error: participantsError } = await supabaseClient
      .from('meeting_participants')
      .select('user_id, profiles(id, email, full_name)')
      .eq('meeting_id', meeting_id)

    if (participantsError) {
      console.error('Error fetching participants:', participantsError)
      throw new Error('Failed to fetch meeting participants')
    }

    // Filter to specific recipients if provided
    let recipientList = participants || []
    if (recipient_ids && recipient_ids.length > 0) {
      recipientList = recipientList.filter(
        (p: { user_id: string }) => recipient_ids.includes(p.user_id)
      )
    }

    // Extract email addresses
    const recipients: string[] = []
    for (const participant of recipientList) {
      const profiles = (participant as any).profiles
      const profile = Array.isArray(profiles) ? profiles[0] : profiles
      if (profile?.email) {
        recipients.push(profile.email)
      }
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notifications_sent: 0, recipients: [], message: 'No recipients with email addresses found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Format meeting time with timezone
    const timezone = meeting.timezone || 'UTC'
    const formattedTime = formatMeetingTime(meeting.start_time, timezone)

    // Build email content
    const { subject, body } = buildEmailContent(type, meeting.title, formattedTime, timezone)

    let notificationsSent = 0
    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')

    if (SENDGRID_API_KEY) {
      // Send via SendGrid API
      for (const email of recipients) {
        try {
          const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SENDGRID_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email }] }],
              from: { email: Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@sjinnovation.com' },
              subject,
              content: [{ type: 'text/html', value: body }],
            }),
          })

          if (sendgridResponse.ok || sendgridResponse.status === 202) {
            notificationsSent++
          } else {
            const errorText = await sendgridResponse.text()
            console.error(`SendGrid error for ${email}:`, errorText)
          }
        } catch (sendError) {
          console.error(`Failed to send email to ${email}:`, sendError)
        }
      }
    } else {
      // Graceful degradation: log the notification
      console.log(`[Meeting Notification] SendGrid not configured. Logging notification instead.`)
      console.log(`  Type: ${type}`)
      console.log(`  Meeting: ${meeting.title}`)
      console.log(`  Subject: ${subject}`)
      console.log(`  Recipients: ${recipients.join(', ')}`)
      notificationsSent = recipients.length
    }

    return new Response(
      JSON.stringify({ success: true, notifications_sent: notificationsSent, recipients }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Send meeting notification error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
