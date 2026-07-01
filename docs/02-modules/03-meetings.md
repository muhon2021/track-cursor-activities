# Meetings — Module Blueprint

## Overview

The Meetings module provides meeting lifecycle management: scheduling, recurring series, agendas with takeaways, transcript viewing, AI-powered summaries and task extraction, efficiency analysis, and cross-module meeting linking to clients, deals, and projects.

## Module Name

`Meetings` (in `app_modules` and navigation)

## Routes Owned

From `src/modules/meetings/routes.tsx`:

```
/meetings                      → Meetings schedule (3-tab: schedule, efficiency, action items)
/meetings/series               → Meeting series management
/meetings/transcripts          → Transcript browser
/meetings/:id                  → Meeting detail (7-tab: details, agenda, takeaways, participants, transcript, related-tasks, series-history)
/meetings/new                  → Create meeting (legacy MeetingForm)
/meetings/:id/edit             → Edit meeting (legacy MeetingForm)
```

Admin route (from `src/modules/admin/routes.tsx`):

```
/admin/meeting-analytics       → Meeting analytics + efficiency scoring
```

---

## File Inventory

### Pages (4 files in `src/modules/meetings/pages/`)

| File | Purpose | Route |
|------|---------|-------|
| `MeetingsSchedulePage.tsx` | Meeting list/calendar with 3 tabs | `/meetings` |
| `MeetingDetailV2Page.tsx` | Meeting detail with 7 tabs | `/meetings/:id` |
| `MeetingSeriesPage.tsx` | Recurring series management | `/meetings/series` |
| `MeetingTranscriptsPage.tsx` | Transcript browser with search + status filter | `/meetings/transcripts` |

### Components (13 files in `src/modules/meetings/components/`)

| File | Location | Purpose |
|------|----------|---------|
| `MeetingsCalendar.tsx` | `calendar/` | Calendar view for meetings |
| `MeetingEfficiencyDashboard.tsx` | root | Efficiency dashboard with score, stats, trend chart |
| `ActionItemsPanel.tsx` | root | Pending action items with due date urgency |
| `RelatedTasksTab.tsx` | root | Action items and linked tasks from takeaways |
| `AgendaTab.tsx` | `agenda/` | Agenda management tab |
| `PreviousAgendaViewer.tsx` | `agenda/` | Read-only agenda from previous meeting in series |
| `ParticipantsTab.tsx` | `participants/` | Participant list and management |
| `AddParticipantDialog.tsx` | `participants/` | Add participant dialog |
| `MeetingParticipantSelector.tsx` | `participants/` | Inline participant selector with avatars |
| `TakeawaysTab.tsx` | `takeaways/` | Takeaways/decisions tab |
| `TranscriptTab.tsx` | `transcript/` | Transcript viewer with AI summary |
| `SeriesCard.tsx` | `series/` | Series card for listing |
| `SeriesHistoryTab.tsx` | `series/` | Timeline of meetings in a series |

### Hooks (10 files in `src/modules/meetings/hooks/`)

| Hook | Purpose | Tables Queried |
|------|---------|----------------|
| `useMeetingAgenda.ts` | Agenda item CRUD | `meeting_agenda_items` |
| `useMeetingParticipants.ts` | Participant management | `meeting_participants` |
| `useMeetingTakeaways.ts` | Takeaway CRUD | `meeting_takeaways` |
| `useRecurringMeetings.ts` | Series CRUD | `meeting_series`, `meetings` |
| `useMeetingActionItems.ts` | Action items (per meeting + my items) | `meeting_takeaways` |
| `useMeetingAssignment.ts` | Cross-entity meeting linking | `meeting_assignments` |
| `useCrossModuleMeetings.ts` | Client/deal/project meetings | `meeting_assignments` |
| `useMeetingEfficiency.ts` | Efficiency metrics + scoring | `meetings`, `meeting_agenda_items`, `meeting_takeaways`, `meeting_participants` |
| `useExtractMeetingTasks.ts` | AI task extraction from transcripts | `meeting_transcripts`, `meeting_takeaways` |
| `useGenerateMeetingSummary.ts` | AI summary generation | `meeting_transcripts` |

### Types

`src/modules/meetings/types/index.ts` — Complete type definitions:
- `MeetingV2`, `MeetingSeries`, `MeetingAgendaItem`, `MeetingTakeaway`
- `MeetingParticipant`, `MeetingTranscript`, `MeetingAssignment`
- Enums: `MeetingStatus`, `MeetingProvider`, `TakeawayType`, `RSVPStatus`, `AssignmentEntityType`

### Edge Functions (2 invoked from frontend)

| Function | Purpose | Called From |
|----------|---------|-------------|
| `extract-meeting-tasks` | AI extraction of tasks from transcripts | `useExtractMeetingTasks` |
| `generate-meeting-summary` | AI summary generation | `useGenerateMeetingSummary` |

Additional meeting-related functions exist (`categorize-meeting`, `zoom-transcript-processing`, `sync-zoom-files`) but are called from platform-level hooks rather than the meetings module directly.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `meetings` | Meeting records (title, date, status, provider, series_id) |
| `meeting_agenda_items` | Agenda items with presenter and time allocation |
| `meeting_takeaways` | Takeaways (decisions, action items, notes, follow-ups) |
| `meeting_participants` | Participant list with RSVP and attendance |
| `meeting_transcripts` | Transcript content with speaker segments |
| `meeting_series` | Recurring meeting definitions |
| `meeting_assignments` | Cross-entity linking (client, deal, project) |

## Cross-Module Dependencies

**Depends on:** Platform Core (auth, layouts, UI)
**Used by:**
- Projects (`useProjectMeetings` from `useCrossModuleMeetings`)
- Business Dev (`useClientMeetings`, `useDealMeetings` from `useCrossModuleMeetings`)
- EOS (`useExtractMeetingIssues` extracts issues from transcripts)
- Admin (MeetingAnalytics page uses `useMeetingEfficiency`)

## Implementation Status

| Component | Status |
|-----------|--------|
| MeetingsSchedulePage (3-tab: schedule, efficiency, action items) | Done |
| MeetingDetailV2Page (7-tab layout) | Done |
| MeetingSeriesPage | Done |
| MeetingTranscriptsPage | Done |
| Agenda CRUD | Done |
| Takeaway CRUD | Done |
| Participant management | Done |
| Transcript viewer + AI summary | Done |
| Action items panel | Done |
| Series history timeline | Done |
| Previous agenda viewer | Done |
| Efficiency dashboard | Done |
| Cross-module hooks (client/deal/project meetings) | Done |
| AI task extraction | Done |
| AI summary generation | Done |
| MeetingAnalytics admin page | Done |

### Known Issues

- 20 instances of `(supabase as any)` casts for complex join queries
- Legacy `MeetingForm.tsx` in `src/pages/` still used for create/edit routes
