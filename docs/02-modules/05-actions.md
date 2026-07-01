# Actions — Module Blueprint

## Overview

The Actions module provides standalone task management independent of projects. It includes task listing with view tabs (Today, This Week, Overdue, Delegated, All), task detail with comments and subtasks, and stream-based workspace organization.

**Naming:** Standalone tasks are called "Actions" in the module system to distinguish from project-scoped tasks. The database table remains `tasks_v2`.

## Module Name

`Actions` (in `app_modules` and navigation)

## Routes Owned

From `src/modules/actions/routes.tsx`:

```
/tasks                         → Task listing (view tabs)
/tasks/new                     → Create task (legacy TaskForm)
/tasks/streams                 → Streams overview
/tasks/streams/:streamId       → Tasks by stream
/tasks/:id                     → Task detail
/tasks/:id/edit                → Edit task (legacy TaskForm)
```

---

## File Inventory

### Pages (4 files in `src/modules/actions/pages/`)

| File | Purpose | Route |
|------|---------|-------|
| `TasksPage.tsx` | Task listing with view tabs and filters | `/tasks` |
| `TaskDetailPage.tsx` | Task detail with comments and subtasks | `/tasks/:id` |
| `StreamsPage.tsx` | Streams overview with cards | `/tasks/streams` |
| `StreamTasksPage.tsx` | Tasks filtered by stream | `/tasks/streams/:streamId` |

### Components (8 files in `src/modules/actions/components/`)

| File | Location | Purpose |
|------|----------|---------|
| `TasksTable.tsx` | root | Task data table with sorting |
| `SubTasksList.tsx` | root | Subtask list with create/toggle |
| `TaskViewTabs.tsx` | root | View tabs (Today, This Week, etc.) |
| `CreateTaskDialog.tsx` | root | Create task dialog form |
| `TaskFiltersBar.tsx` | root | Filter bar (status, priority, stream) |
| `CommentThread.tsx` | `comments/` | Threaded comment display and input |
| `StreamCard.tsx` | `streams/` | Stream card for overview |
| `CreateStreamDialog.tsx` | `streams/` | Create stream dialog |

### Hooks (4 files in `src/modules/actions/hooks/`)

| Hook | Purpose | Tables Queried |
|------|---------|----------------|
| `useTasksV2.ts` | Task CRUD with view-based filters | `tasks_v2` |
| `useTaskComments.ts` | Comment CRUD with threading | `task_comments_v2` |
| `useTaskStreams.ts` | Stream CRUD + membership | `task_streams`, `task_stream_members` |
| `useTaskCategories.ts` | Category listing | `task_categories` |

### Edge Functions

No edge functions are invoked directly from the Actions module.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `tasks_v2` | Task records (title, status, priority, assignee, stream, due date) |
| `task_comments_v2` | Threaded comments on tasks |
| `task_streams` | Stream (workspace) definitions |
| `task_stream_members` | Stream membership |
| `task_categories` | Task categories |

## Cross-Module Dependencies

**Depends on:** Platform Core (auth, layouts, UI)
**Future integrations:**
- Meetings: convert takeaways to tasks
- EOS: link EOS issues to action items

## Implementation Status

| Component | Status |
|-----------|--------|
| TasksPage with view tabs | Done |
| TaskDetailPage with comments + subtasks | Done |
| StreamsPage | Done |
| StreamTasksPage | Done |
| Task CRUD hooks | Done |
| Comment threading | Done |
| Stream CRUD | Done |
| Category listing | Done |

### Pending

- Task AI assistant (edge function + hook)
- Admin pages for stream management
- Subtask creation UI improvements
- Legacy `TaskForm.tsx` in `src/pages/` still used for create/edit routes
