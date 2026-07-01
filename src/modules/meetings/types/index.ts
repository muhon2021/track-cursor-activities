/**
 * Meetings Module V2 Types
 *
 * Extended type definitions for the full meetings lifecycle:
 * series, agenda, takeaways, participants, transcripts, categorizations,
 * assignments, external participants, action items, and assignment suggestions.
 */

// Re-export existing Meeting type from legacy hook
export type { Meeting } from "@/hooks/useMeetings";

// ========================
// Meeting V2 (extended)
// ========================

export interface MeetingV2 {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  provider: string | null;
  status: string | null;
  client_id: string | null;
  organizer_id: string;
  location: string | null;
  meeting_type: string | null;
  join_url: string | null;
  host_url: string | null;
  // V2 fields
  series_id: string | null;
  slug: string | null;
  is_recurring: boolean;
  agenda_finalized: boolean;
  summary: string | null;
  action_items: unknown[];
  efficiency_score: number | null;
  closed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Replication guide alignment fields
  deal_id: string | null;
  pod_id: string | null;
  recording_url: string | null;
  transcript_content: string | null;
  transcript_text: string | null;
  ai_summary: string | null;
  notes: string | null;
  timezone: string | null;
  recurrence_pattern: string | null;
  recurrence_end_date: string | null;
  parent_meeting_id: string | null;
  categorization_data: Record<string, unknown> | null;
  embedding_status: string | null;
  is_external: boolean;
  // Joined relations
  clients?: { name: string; email?: string | null } | null;
  series?: MeetingSeries | null;
  agenda_items?: MeetingAgendaItem[];
  takeaways?: MeetingTakeaway[];
  participants?: MeetingParticipant[];
  external_participants?: MeetingExternalParticipant[];
  transcript?: MeetingTranscript | null;
  action_items_extracted?: MeetingActionItem[];
}

export type MeetingStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type MeetingProvider =
  | "zoom"
  | "google_meet"
  | "microsoft_teams"
  | "webex"
  | "other";

// ========================
// Meeting Series
// ========================

export interface MeetingSeries {
  id: string;
  title: string;
  description: string | null;
  recurrence_rule: string;
  duration_minutes: number;
  organizer_id: string;
  default_agenda: AgendaTemplate[];
  is_active: boolean;
  next_occurrence: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  meetings_count?: number;
}

export interface AgendaTemplate {
  title: string;
  duration_minutes?: number;
  description?: string;
}

export interface SeriesFormData {
  title: string;
  description?: string;
  recurrence_rule: string;
  duration_minutes: number;
  default_agenda?: AgendaTemplate[];
}

// ========================
// Agenda Items
// ========================

export interface MeetingAgendaItem {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  presenter_id: string | null;
  assigned_to: string | null;
  sort_order: number;
  is_completed: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  presenter?: { full_name: string; email: string } | null;
  assignee?: { full_name: string; email: string } | null;
  takeaways?: MeetingTakeaway[];
}

export interface AgendaItemFormData {
  title: string;
  description?: string;
  duration_minutes?: number;
  presenter_id?: string;
}

// ========================
// Takeaways
// ========================

export type TakeawayType = "decision" | "action_item" | "note" | "follow_up";

export interface MeetingTakeaway {
  id: string;
  meeting_id: string;
  agenda_item_id: string | null;
  content: string;
  takeaway_type: TakeawayType;
  assigned_to: string | null;
  due_date: string | null;
  is_completed: boolean;
  priority: TakeawayPriority;
  status: TakeawayStatus;
  task_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  assignee?: { full_name: string; email: string } | null;
}

export type TakeawayPriority = "low" | "medium" | "high";
export type TakeawayStatus = "open" | "in_progress" | "completed" | "cancelled";

export interface TakeawayFormData {
  content: string;
  takeaway_type: TakeawayType;
  agenda_item_id?: string;
  assigned_to?: string;
  due_date?: string;
}

// ========================
// Participants
// ========================

export type ParticipantRole = "organizer" | "presenter" | "attendee" | "optional";
export type RSVPStatus = "pending" | "accepted" | "declined" | "tentative";

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  role: ParticipantRole;
  rsvp_status: RSVPStatus;
  attended: boolean;
  joined_at: string | null;
  left_at: string | null;
  response_at: string | null;
  created_at: string;
  // Joined
  user?: { full_name: string; email: string; avatar_url?: string } | null;
}

// ========================
// External Participants
// ========================

export interface MeetingExternalParticipant {
  id: string;
  meeting_id: string;
  external_email: string;
  external_name: string | null;
  role: ExternalParticipantRole;
  status: RSVPStatus;
  created_at: string;
  updated_at: string;
}

export type ExternalParticipantRole = "organizer" | "required" | "optional";

// ========================
// Transcripts
// ========================

export interface MeetingTranscript {
  id: string;
  meeting_id: string;
  content: string;
  language: string;
  source: "zoom" | "teams" | "google_meet" | "manual" | "upload";
  word_count: number | null;
  duration_seconds: number | null;
  speakers: TranscriptSpeaker[];
  processed_at: string | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptSpeaker {
  name: string;
  segments: { start: number; end: number; text: string }[];
}

// ========================
// Categorizations
// ========================

export interface MeetingCategorization {
  id: string;
  meeting_id: string;
  category: string;
  meeting_type: string | null;
  confidence: number;
  source: "manual" | "ai" | "rule";
  rule_id: string | null;
  created_by: string | null;
  related_clients: Array<{ client_id: string; confidence: number }> | null;
  related_projects: string[] | null;
  related_pods: string[] | null;
  tags: string[] | null;
  created_at: string;
}

// ========================
// Assignments
// ========================

export type AssignmentEntityType = "client" | "project" | "deal";

export interface MeetingAssignment {
  id: string;
  meeting_id: string;
  entity_type: AssignmentEntityType;
  entity_id: string;
  assigned_by: string | null;
  created_at: string;
}

// ========================
// Action Items (extracted from transcripts)
// ========================

export interface MeetingActionItem {
  id: string;
  meeting_id: string;
  text: string;
  assignee_id: string | null;
  assignee_email: string | null;
  due_date: string | null;
  priority: ActionItemPriority;
  task_id: string | null;
  status: ActionItemStatus;
  extracted_from_transcript: boolean;
  extraction_confidence: number | null;
  created_at: string;
  updated_at: string;
  // Joined
  assignee?: { full_name: string; email: string } | null;
  task?: { id: string; title: string; status: string } | null;
}

export type ActionItemPriority = "low" | "medium" | "high";
export type ActionItemStatus = "pending" | "in_progress" | "completed";

// ========================
// Assignment Suggestions (AI-generated)
// ========================

export interface MeetingAssignmentSuggestion {
  id: string;
  meeting_id: string;
  suggested_type: SuggestionEntityType;
  suggested_id: string;
  confidence: number;
  reasoning: string | null;
  review_status: SuggestionReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  suggested_entity?: { name: string } | null;
  reviewer?: { full_name: string } | null;
}

export type SuggestionEntityType = "client" | "project" | "pod";
export type SuggestionReviewStatus = "pending" | "approved" | "rejected";

/** Confidence thresholds for AI assignment suggestions */
export const ASSIGNMENT_CONFIDENCE = {
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0,
} as const;

// ========================
// Client Meeting Links
// ========================

export interface ClientMeeting {
  id: string;
  client_id: string;
  meeting_id: string;
  created_at: string;
  // Joined
  meeting?: MeetingV2 | null;
  client?: { name: string; email?: string | null } | null;
}

// ========================
// Contact Meeting Links
// ========================

export interface ContactMeetingLink {
  id: string;
  contact_id: string;
  meeting_id: string;
  created_at: string;
  // Joined
  meeting?: MeetingV2 | null;
  contact?: { name: string; email: string } | null;
}

// ========================
// Meeting File (extended with assignment workflow)
// ========================

export interface MeetingFile {
  id: string;
  meeting_id: string | null;
  provider: string;
  external_meeting_id: string | null;
  file_type: string;
  file_name: string;
  file_size: number | null;
  file_path: string | null;
  storage_path: string | null;
  download_url: string | null;
  transcript_text: string | null;
  transcript_content: Record<string, unknown> | null;
  is_processed: boolean;
  has_embeddings: boolean;
  processing_status: string;
  metadata: Record<string, unknown>;
  // Assignment workflow fields
  assignment_status: FileAssignmentStatus;
  assignment_confidence: number | null;
  suggested_client_id: string | null;
  suggested_project_id: string | null;
  suggested_pod_id: string | null;
  assignment_reasoning: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  meeting?: MeetingV2 | null;
  suggested_client?: { name: string } | null;
}

export type FileAssignmentStatus = "unreviewed" | "pending_review" | "assigned" | "rejected";

// ========================
// Filters & Views
// ========================

export interface MeetingFilters {
  status?: MeetingStatus | "all";
  provider?: MeetingProvider | "all";
  client_id?: string;
  series_id?: string;
  date_range?: { start: string; end: string };
  search?: string;
}

export type MeetingView = "list" | "calendar";

export type MeetingDetailTab =
  | "details"
  | "agenda"
  | "takeaways"
  | "transcript"
  | "participants"
  | "series"
  | "related-tasks"
  | "series-history";

// ========================
// Helper Functions
// ========================

/** Check if a participant is external (no user_id) */
export function isExternalParticipant(p: MeetingParticipant | MeetingExternalParticipant): boolean {
  return "external_email" in p;
}

/** Check if a participant is the organizer */
export function isOrganizer(p: MeetingParticipant): boolean {
  return p.role === "organizer";
}

/** Check if a participant has accepted */
export function hasAccepted(p: MeetingParticipant): boolean {
  return p.rsvp_status === "accepted";
}

/** Get organizer from participant list */
export function getOrganizer(
  participants: MeetingParticipant[]
): MeetingParticipant | undefined {
  return participants.find((p) => p.role === "organizer");
}

/** Get display name for any participant type */
export function getParticipantDisplayName(
  p: MeetingParticipant | MeetingExternalParticipant
): string {
  if ("external_name" in p) {
    return p.external_name || p.external_email;
  }
  return p.user?.full_name || p.name || p.email || "Unknown";
}

/** Get display email for any participant type */
export function getParticipantDisplayEmail(
  p: MeetingParticipant | MeetingExternalParticipant
): string {
  if ("external_email" in p) {
    return p.external_email;
  }
  return p.user?.email || p.email || "";
}
