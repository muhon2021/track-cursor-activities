/**
 * Lead Follow-Up Hooks
 * Core hooks for lead follow-up operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ============ TYPES ============

export interface Contact {
  id: string
  first_name: string
  last_name?: string
  email?: string
  phone?: string
  company?: string
  title?: string
  is_lead_follow_up: boolean
  followup_status: string
  followup_interval_days: number
  last_contact_date?: string
  next_followup_date?: string
  followup_notes?: string
  followup_assigned_to?: string
  followup_attempt_count: number
  preferred_contact_channel: string
  current_mood_label?: 'warm' | 'neutral' | 'cold'
  current_mood_score?: number
  current_intent_status?: 'active' | 'stalled' | 'dormant'
  lead_score?: number
  lead_temperature?: 'hot' | 'warm' | 'cold'
}

export interface ContactActivity {
  id: string
  contact_id: string
  activity_type: string
  subject?: string
  description?: string
  channel: string
  direction: 'outbound' | 'inbound' | 'internal'
  email_to?: string[]
  email_body?: string
  created_at: string
  created_by?: string
}

export interface MoodAnalysis {
  id: string
  contact_id: string
  mood_score: number
  mood_label: 'warm' | 'neutral' | 'cold'
  confidence: 'high' | 'medium' | 'low'
  key_signals: string[]
  reasoning: string
  suggested_action: string
  analyzed_at: string
}

export interface IntentAnalysis {
  id: string
  contact_id: string
  intent_status: 'active' | 'stalled' | 'dormant'
  momentum_score: number
  confidence: 'high' | 'medium' | 'low'
  momentum_signals: string[]
  decay_signals: string[]
  days_since_activity?: number
  reasoning: string
  suggested_action: string
  analyzed_at: string
}

// ============ CONTACTS ============

export const useLeadFollowUpContacts = (filters?: {
  search?: string
  status?: string
  assignedTo?: string
  temperature?: string
}) => {
  return useQuery({
    queryKey: ['lead-followup-contacts', filters],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('is_lead_follow_up', true)

      if (filters?.search) {
        query = query.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
        )
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('followup_status', filters.status)
      }

      if (filters?.temperature && filters.temperature !== 'all') {
        query = query.eq('lead_temperature', filters.temperature)
      }

      const { data, error } = await query.order('lead_score', { ascending: false })

      if (error) throw error
      return data as Contact[]
    },
  })
}

export const useContactBySlug = (slug: string) => {
  return useQuery({
    queryKey: ['contact', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', slug)
        .single()

      if (error) throw error
      return data as Contact
    },
    enabled: !!slug,
  })
}

export const useUpdateContactFollowUp = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      contactId,
      updates,
    }: {
      contactId: string
      updates: Partial<Contact>
    }) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', contactId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      queryClient.invalidateQueries({ queryKey: ['lead-followup-contacts'] })
    },
  })
}

export const useLogContact = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      contactId,
      activityType,
      description,
      channel = 'email',
    }: {
      contactId: string
      activityType: string
      description: string
      channel?: string
    }) => {
      // Create activity
      const { error: activityError } = await supabase
        .from('contact_activities')
        .insert({
          contact_id: contactId,
          activity_type: activityType,
          description,
          channel,
          direction: 'outbound',
        })

      if (activityError) throw activityError

      // Update contact last_contact_date
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          last_contact_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId)

      if (updateError) throw updateError
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contact-activities', contactId] })
    },
  })
}

export const useMarkAsLeadFollowUp = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { data, error } = await supabase
        .from('contacts')
        .update({
          is_lead_follow_up: true,
          followup_status: 'new',
          followup_interval_days: 7,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, contactId) => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      queryClient.invalidateQueries({ queryKey: ['lead-followup-contacts'] })
    },
  })
}

export const useCompleteFollowUp = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { data, error } = await supabase
        .from('contacts')
        .update({
          followup_status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, contactId) => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      queryClient.invalidateQueries({ queryKey: ['lead-followup-contacts'] })
    },
  })
}

// ============ ACTIVITIES ============

export const useContactActivities = (contactId: string) => {
  return useQuery({
    queryKey: ['contact-activities', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('contact_id', contactId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as ContactActivity[]
    },
    enabled: !!contactId,
  })
}

export const useCreateContactActivity = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (activity: Omit<ContactActivity, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('contact_activities')
        .insert(activity)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, activity) => {
      queryClient.invalidateQueries({ queryKey: ['contact-activities', activity.contact_id] })
      queryClient.invalidateQueries({ queryKey: ['contact', activity.contact_id] })
    },
  })
}

// ============ ANALYSIS ============

export const useMoodAnalysis = (contactId: string) => {
  return useQuery({
    queryKey: ['mood-analysis', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_mood_analysis')
        .select('*')
        .eq('contact_id', contactId)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code === 'PGRST116') return null
      if (error) throw error
      return data as MoodAnalysis | null
    },
    enabled: !!contactId,
  })
}

export const useIntentAnalysis = (contactId: string) => {
  return useQuery({
    queryKey: ['intent-analysis', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_intent_analysis')
        .select('*')
        .eq('contact_id', contactId)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code === 'PGRST116') return null
      if (error) throw error
      return data as IntentAnalysis | null
    },
    enabled: !!contactId,
  })
}

export const useTriggerMoodAnalysis = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contactId: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-ai-agent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            agent_slug: 'client-mood-analyzer',
            contact_id: contactId,
          }),
        }
      )

      if (!response.ok) throw new Error('Failed to analyze mood')
      return response.json()
    },
    onSuccess: (_, contactId) => {
      queryClient.invalidateQueries({ queryKey: ['mood-analysis', contactId] })
    },
  })
}

export const useTriggerIntentAnalysis = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contactId: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-ai-agent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            agent_slug: 'client-intent-analyzer',
            contact_id: contactId,
          }),
        }
      )

      if (!response.ok) throw new Error('Failed to analyze intent')
      return response.json()
    },
    onSuccess: (_, contactId) => {
      queryClient.invalidateQueries({ queryKey: ['intent-analysis', contactId] })
    },
  })
}

// ============ UTILITIES ============

export const useLeadFollowUpSettings = () => {
  return useQuery({
    queryKey: ['lead-followup-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('category', 'lead_followup')

      if (error) throw error

      return {
        minInterval: parseInt(data?.find(s => s.key === 'min_interval_days')?.value || '3'),
        maxInterval: parseInt(data?.find(s => s.key === 'max_interval_days')?.value || '90'),
        defaultInterval: parseInt(data?.find(s => s.key === 'default_interval_days')?.value || '7'),
      }
    },
  })
}

export const useOverdueFollowUps = () => {
  return useQuery({
    queryKey: ['overdue-followups'],
    queryFn: async () => {
      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('is_lead_follow_up', true)
        .neq('followup_status', 'completed')
        .lt('next_followup_date', now)

      if (error) throw error
      return data as Contact[]
    },
  })
}

export const useDueTodayFollowUps = () => {
  return useQuery({
    queryKey: ['due-today-followups'],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('is_lead_follow_up', true)
        .neq('followup_status', 'completed')
        .gte('next_followup_date', today.toISOString())
        .lt('next_followup_date', tomorrow.toISOString())

      if (error) throw error
      return data as Contact[]
    },
  })
}
