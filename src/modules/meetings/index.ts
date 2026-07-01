export { meetingsRoutes } from "./routes";

// Re-export key hooks for cross-module consumption
export { useClientMeetings, useAddClientMeeting, useRemoveClientMeeting } from "./hooks/useClientMeetings";
export { useProjectMeetings } from "./hooks/useProjectMeetings";
export { useDealMeetings } from "./hooks/useDealMeetings";
export { useContactMeetings, useAddContactMeetingLink, useRemoveContactMeetingLink } from "./hooks/useContactMeetings";
export { useEntityMeetings, useAddEntityMeeting, useRemoveEntityMeeting } from "./hooks/useEntityMeetings";
export { useMeetingSearch } from "./hooks/useMeetingSearch";
export { useCalendarMeetings, useMeetingsForMonth } from "./hooks/useCalendarMeetings";
export { usePendingAssignmentCount } from "./hooks/usePendingAssignmentCount";
export { useKnowledgeMeetings } from "./hooks/useKnowledgeMeetings";
export {
  useMeetingAgents,
  useSummarizeMeeting,
  useExtractActionItems,
  useCategorizeMeeting,
  usePrepareMeeting,
  useAnalyzeTranscript,
  useGenerateFollowUpEmail,
  useAnalyzeMeetingEfficiency,
  useMatchMeetingToClient,
} from "./hooks/useMeetingAIAgents";

// Re-export utilities
export { formatMeetingDateTime, formatRecurrencePattern } from "./utils";

// Re-export types
export type {
  MeetingV2,
  MeetingParticipant,
  MeetingExternalParticipant,
  MeetingAgendaItem,
  MeetingTakeaway,
  MeetingActionItem,
  MeetingAssignmentSuggestion,
  MeetingCategorization,
  MeetingFile,
  ClientMeeting,
  ContactMeetingLink,
  MeetingFilters,
  MeetingView,
  MeetingDetailTab,
} from "./types";
