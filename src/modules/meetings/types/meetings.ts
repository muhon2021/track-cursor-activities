/**
 * Meetings Module Types - Re-exports from canonical index.ts
 * 
 * This file re-exports types from the canonical types/index.ts file.
 * Hooks that previously imported from this file continue to work.
 */

// Re-export all types from the canonical source
export type {
  MeetingV2,
  MeetingStatus,
  MeetingAgendaItem,
  MeetingTakeaway,
  TakeawayStatus,
  TakeawayPriority,
  MeetingParticipant as MeetingParticipantV2,
  MeetingParticipant,
  ParticipantRole,
  RSVPStatus as ParticipantStatus,
  MeetingFile,
  MeetingCategorization,
  MeetingDetailTab,
} from "./index";

export {
  isExternalParticipant,
  getParticipantDisplayName,
  getParticipantDisplayEmail,
} from "./index";

// Type alias for backward compat
export type MeetingParticipantWithProfile = import("./index").MeetingParticipant;

// Meeting type enum (DB meetings_v2 uses "type" column)
export type MeetingType = "internal" | "client" | "project" | "l10" | "one_on_one";

/** Row shape from meetings_v2 table (schedule list/detail/calendar) */
export interface MeetingV2Schedule {
  id: string;
  title: string;
  type: MeetingType;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  timezone: string | null;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  notes: string | null;
  slug: string | null;
  created_by: string | null;
  client_id: string | null;
  project_id: string | null;
  deal_id: string | null;
  recurrence_pattern: string | null;
  recurrence_interval: number | null;
  recurrence_days_of_week: number[] | null;
  recurrence_day_of_month: number | null;
  recurrence_end_date: string | null;
  parent_meeting_id: string | null;
  recording_url: string | null;
  transcript_content: unknown;
  transcript_text: string | null;
  ai_summary: unknown;
  created_at: string;
  updated_at: string;
  notify_participants?: boolean;
}

// Form data type for creating/updating meetings
export interface MeetingV2FormData {
  title: string;
  meeting_type?: string;
  description?: string;
  scheduled_at: string;
  duration_minutes: number;
  location?: string;
  timezone?: string;
  status?: string;
  notes?: string;
  notify_participants?: boolean;
  client_id?: string;
  project_id?: string;
  deal_id?: string;
  recurrence_pattern?: string;
  recurrence_end_date?: string;
  parent_meeting_id?: string;
}

// Participant profile shape from joins
export interface ParticipantProfile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}
