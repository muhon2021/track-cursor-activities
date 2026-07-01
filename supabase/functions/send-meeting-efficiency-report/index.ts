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

    // Parse optional parameters from request body
    let period: 'weekly' | 'monthly' = 'weekly'
    let targetUserId: string | null = null

    try {
      const body = await req.json()
      if (body?.period === 'monthly') {
        period = 'monthly'
      }
      if (body?.user_id) {
        targetUserId = body.user_id
      }
    } catch {
      // No body provided (cron invocation) — use defaults
    }

    // Determine date range
    const now = new Date()
    const daysBack = period === 'weekly' ? 7 : 30
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    const startDateISO = startDate.toISOString()

    console.log(`Generating ${period} efficiency report from ${startDateISO}`)

    // Fetch meetings in date range with efficiency_score
    const { data: meetings, error: meetingsError } = await supabaseClient
      .from('meetings')
      .select('id, title, organizer_id, efficiency_score, duration_minutes, scheduled_at, status')
      .gte('scheduled_at', startDateISO)
      .lte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: false })

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError)
      throw new Error(`Failed to fetch meetings: ${meetingsError.message}`)
    }

    if (!meetings || meetings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, report_sent_to: 0, message: 'No meetings found in the specified period' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Calculate aggregate stats
    const meetingsWithScore = meetings.filter((m) => m.efficiency_score !== null)
    const avgEfficiency = meetingsWithScore.length > 0
      ? meetingsWithScore.reduce((sum, m) => sum + (m.efficiency_score || 0), 0) / meetingsWithScore.length
      : 0

    const meetingsWithDuration = meetings.filter((m) => m.duration_minutes !== null)
    const avgDuration = meetingsWithDuration.length > 0
      ? meetingsWithDuration.reduce((sum, m) => sum + (m.duration_minutes || 0), 0) / meetingsWithDuration.length
      : 0

    const totalMeetings = meetings.length
    const completedMeetings = meetings.filter((m) => m.status === 'completed').length

    // Calculate top performers (organizers with highest avg efficiency)
    const organizerScores: Record<string, { total: number; count: number }> = {}
    for (const meeting of meetingsWithScore) {
      const orgId = meeting.organizer_id
      if (!organizerScores[orgId]) {
        organizerScores[orgId] = { total: 0, count: 0 }
      }
      organizerScores[orgId].total += meeting.efficiency_score || 0
      organizerScores[orgId].count++
    }

    const topPerformerIds = Object.entries(organizerScores)
      .map(([id, scores]) => ({ id, avg: scores.total / scores.count, count: scores.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)

    // Fetch profile names for top performers
    let topPerformers: Array<{ name: string; avg_score: number; meeting_count: number }> = []
    if (topPerformerIds.length > 0) {
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, full_name, email')
        .in('id', topPerformerIds.map((p) => p.id))

      topPerformers = topPerformerIds.map((p) => {
        const profile = profiles?.find((pr) => pr.id === p.id)
        return {
          name: profile?.full_name || profile?.email || 'Unknown',
          avg_score: Math.round(p.avg * 10) / 10,
          meeting_count: p.count,
        }
      })
    }

    // Build HTML email report
    const reportTitle = `Meeting Efficiency Report - ${period === 'weekly' ? 'Weekly' : 'Monthly'}`
    const dateRangeStr = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

    const topPerformersHtml = topPerformers.length > 0
      ? topPerformers.map((p, i) =>
          `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${i + 1}. ${p.name}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">${p.avg_score}/10</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">${p.meeting_count}</td>
          </tr>`
        ).join('')
      : '<tr><td colspan="3" style="padding: 8px 12px; text-align: center;">No data available</td></tr>'

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${reportTitle}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h1 style="color: #1a1a2e; border-bottom: 2px solid #4a90d9; padding-bottom: 10px;">${reportTitle}</h1>
        <p style="color: #666; font-size: 14px;">${dateRangeStr}</p>

        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #1a1a2e;">Summary</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Total Meetings</td>
              <td style="padding: 8px 0; text-align: right;">${totalMeetings}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Completed</td>
              <td style="padding: 8px 0; text-align: right;">${completedMeetings}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Avg Efficiency Score</td>
              <td style="padding: 8px 0; text-align: right;">${meetingsWithScore.length > 0 ? (Math.round(avgEfficiency * 10) / 10) + '/10' : 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Avg Duration</td>
              <td style="padding: 8px 0; text-align: right;">${meetingsWithDuration.length > 0 ? Math.round(avgDuration) + ' min' : 'N/A'}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 20px 0;">
          <h2 style="color: #1a1a2e;">Top Performers</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #4a90d9; color: white;">
                <th style="padding: 10px 12px; text-align: left;">Organizer</th>
                <th style="padding: 10px 12px; text-align: center;">Avg Score</th>
                <th style="padding: 10px 12px; text-align: center;">Meetings</th>
              </tr>
            </thead>
            <tbody>
              ${topPerformersHtml}
            </tbody>
          </table>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
          This is an automated report generated by SJ Control Tower.
        </p>
      </body>
      </html>
    `

    // Determine recipients
    let recipientEmails: string[] = []

    if (targetUserId) {
      // Send to specific user
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('email')
        .eq('id', targetUserId)
        .single()

      if (profile?.email) {
        recipientEmails = [profile.email]
      }
    } else {
      // Send to all admins
      const { data: adminRoles } = await supabaseClient
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')

      if (adminRoles && adminRoles.length > 0) {
        const adminIds = adminRoles.map((r) => r.user_id)
        const { data: adminProfiles } = await supabaseClient
          .from('profiles')
          .select('email')
          .in('id', adminIds)

        if (adminProfiles) {
          recipientEmails = adminProfiles
            .map((p) => p.email)
            .filter((email): email is string => !!email)
        }
      }
    }

    // Send emails via SendGrid
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY')
    let sentCount = 0

    if (!sendgridApiKey) {
      console.warn('SENDGRID_API_KEY not configured, skipping email delivery')
      return new Response(
        JSON.stringify({
          success: true,
          report_sent_to: 0,
          message: 'Report generated but SENDGRID_API_KEY is not configured. Email delivery skipped.',
          stats: {
            total_meetings: totalMeetings,
            completed_meetings: completedMeetings,
            avg_efficiency: Math.round(avgEfficiency * 10) / 10,
            avg_duration: Math.round(avgDuration),
            top_performers: topPerformers,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    for (const email of recipientEmails) {
      try {
        const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: 'noreply@sjcontroltower.com', name: 'SJ Control Tower' },
            subject: reportTitle,
            content: [
              { type: 'text/html', value: htmlBody },
            ],
          }),
        })

        if (sendgridResponse.ok || sendgridResponse.status === 202) {
          sentCount++
          console.log(`Report sent to ${email}`)
        } else {
          const errorText = await sendgridResponse.text()
          console.error(`Failed to send report to ${email}:`, errorText)
        }
      } catch (emailError) {
        console.error(`Error sending email to ${email}:`, emailError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_sent_to: sentCount,
        stats: {
          total_meetings: totalMeetings,
          completed_meetings: completedMeetings,
          avg_efficiency: Math.round(avgEfficiency * 10) / 10,
          avg_duration: Math.round(avgDuration),
          top_performers: topPerformers,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Send meeting efficiency report error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
