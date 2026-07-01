/**
 * Email Hooks
 * Email sending, scheduling, templates, and tracking
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ============ TYPES ============

export interface EmailLog {
  id: string
  contact_id?: string
  recipient: string
  subject: string
  body_html?: string
  body_text?: string
  status: 'queued' | 'sending' | 'sent' | 'scheduled' | 'failed' | 'bounced'
  sent_at?: string
  opened_at?: string
  clicked_at?: string
  provider_message_id?: string
  scheduled_for?: string
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: string
  is_active: boolean
  is_system: boolean
  variables: string[]
}

export interface ScheduledEmail {
  id: string
  contact_id?: string
  recipient: string
  subject: string
  body_html?: string
  body_text?: string
  scheduled_for: string
  status: 'scheduled' | 'sent' | 'failed'
}

// ============ EMAIL SENDING ============

export const useSendEmail = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      to,
      cc,
      bcc,
      subject,
      body,
      bodyHtml,
      contactId,
      enableTracking = true,
      schedule,
    }: {
      to: string | string[]
      cc?: string[]
      bcc?: string[]
      subject: string
      body: string
      bodyHtml?: string
      contactId?: string
      enableTracking?: boolean
      schedule?: { sendAt: string }
    }) => {
      const toArray = Array.isArray(to) ? to : [to]

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-with-tracking`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            to: toArray,
            cc,
            bcc,
            subject,
            body,
            bodyHtml,
            contactId,
            enableTracking,
            schedule,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send email')
      }

      return response.json()
    },
    onSuccess: (_, { contactId }) => {
      if (contactId) {
        queryClient.invalidateQueries({ queryKey: ['email-logs', contactId] })
      }
    },
  })
}

// ============ EMAIL SCHEDULING ============

export const useScheduleEmail = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      to,
      cc,
      bcc,
      subject,
      body,
      bodyHtml,
      contactId,
      scheduledFor,
    }: {
      to: string
      cc?: string
      bcc?: string
      subject: string
      body: string
      bodyHtml?: string
      contactId?: string
      scheduledFor: string
    }) => {
      const { data, error } = await supabase
        .from('email_logs')
        .insert({
          recipient: to,
          cc,
          bcc,
          subject,
          body_text: body,
          body_html: bodyHtml,
          contact_id: contactId,
          status: 'scheduled',
          scheduled_for: scheduledFor,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, { contactId }) => {
      if (contactId) {
        queryClient.invalidateQueries({ queryKey: ['scheduled-emails', contactId] })
      }
    },
  })
}

// ============ SCHEDULED EMAILS ============

export const useScheduledEmails = (contactId?: string) => {
  return useQuery({
    queryKey: ['scheduled-emails', contactId],
    queryFn: async () => {
      let query = supabase
        .from('email_logs')
        .select('*')
        .eq('status', 'scheduled')

      if (contactId) {
        query = query.eq('contact_id', contactId)
      }

      const { data, error } = await query.order('scheduled_for', { ascending: true })

      if (error) throw error
      return data as ScheduledEmail[]
    },
    enabled: !!contactId,
  })
}

export const useCancelScheduledEmail = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase
        .from('email_logs')
        .update({ status: 'cancelled' })
        .eq('id', emailId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] })
    },
  })
}

export const useSendScheduledEmailNow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (emailId: string) => {
      // Fetch the email
      const { data: email, error: fetchError } = await supabase
        .from('email_logs')
        .select('*')
        .eq('id', emailId)
        .single()

      if (fetchError) throw fetchError

      // Update status to sending and set sent_at
      const { error: updateError } = await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', emailId)

      if (updateError) throw updateError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] })
      queryClient.invalidateQueries({ queryKey: ['email-logs'] })
    },
  })
}

// ============ EMAIL HISTORY ============

export const useEmailHistory = (contactId?: string) => {
  return useQuery({
    queryKey: ['email-logs', contactId],
    queryFn: async () => {
      let query = supabase
        .from('email_logs')
        .select('*')
        .in('status', ['sent', 'opened', 'clicked'])

      if (contactId) {
        query = query.eq('contact_id', contactId)
      }

      const { data, error } = await query.order('sent_at', { ascending: false })

      if (error) throw error
      return data as EmailLog[]
    },
    enabled: !!contactId,
  })
}

// ============ EMAIL TEMPLATES ============

export const useEmailTemplates = (category?: string) => {
  return useQuery({
    queryKey: ['email-templates', category],
    queryFn: async () => {
      let query = supabase
        .from('contact_email_templates')
        .select('*')
        .eq('is_active', true)

      if (category && category !== 'all') {
        query = query.eq('category', category)
      }

      const { data, error } = await query.order('usage_count', { ascending: false })

      if (error) throw error
      return data as EmailTemplate[]
    },
  })
}

// ============ EMAIL PERFORMANCE ============

export const useEmailPerformanceInsights = (contactId?: string) => {
  return useQuery({
    queryKey: ['email-performance', contactId],
    queryFn: async () => {
      if (!contactId) return null

      const { data, error } = await supabase.rpc('get_contact_email_engagement_metrics', {
        contact_id: contactId,
      })

      if (error) throw error
      return data
    },
    enabled: !!contactId,
  })
}

// ============ CONTACT RESEARCH ============

export const useContactResearch = (contactId?: string) => {
  return useQuery({
    queryKey: ['contact-research', contactId],
    queryFn: async () => {
      if (!contactId) return null

      const { data, error } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('contact_id', contactId)
        .eq('activity_type', 'linkedin_research')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code === 'PGRST116') return null
      if (error) throw error
      return data
    },
    enabled: !!contactId,
  })
}

export const useRunResearchAnalysis = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      contactId,
      contactName,
      contactEmail,
      contactCompany,
    }: {
      contactId: string
      contactName: string
      contactEmail?: string
      contactCompany?: string
    }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-followup-research`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            contact_name: contactName,
            contact_id: contactId,
            contact_email: contactEmail,
            contact_company: contactCompany,
            days_back: 30,
          }),
        }
      )

      if (!response.ok) throw new Error('Research failed')
      return response.json()
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['contact-research', contactId] })
    },
  })
}

// ============ CONVERSATION OPENERS ============

export const useConversationOpener = (contactId?: string) => {
  return useQuery({
    queryKey: ['conversation-openers', contactId],
    queryFn: async () => {
      if (!contactId) return null

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-conversation-opener`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ contact_id: contactId }),
        }
      )

      if (!response.ok) throw new Error('Failed to generate openers')
      return response.json()
    },
    enabled: !!contactId,
  })
}
