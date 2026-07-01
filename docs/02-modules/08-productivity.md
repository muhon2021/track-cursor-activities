# Productivity — Module Blueprint

## Overview

The Productivity module tracks team and individual employee productivity metrics with department and pod-level analysis. It also includes the Process documentation system (SOP library organized by category).

## Module Names

- `Productivity` (in `app_modules`, slug: `productivity`)
- `Process` (in `app_modules`, slug: `process`)

## Routes Owned

From `src/modules/productivity/routes.tsx`:

```
/productivity                          → Productivity dashboard
/productivity/employee/:email          → Employee detail
/process                               → Process documentation index
/process/new                           → Create process document
/process/:category                     → Process category listing
/process/:category/new                 → Create in category
/process/:category/:slug               → Process document view
/process/:category/:slug/edit          → Edit process document
```

---

## File Inventory

### Pages (4 files in `src/modules/productivity/pages/`)

| File | Purpose | Route |
|------|---------|-------|
| `ProductivityPage.tsx` | Dashboard with summary cards, department grid, pod breakdown, utilization chart, attendance donut, employee table | `/productivity` |
| `EmployeeDetailPage.tsx` | Individual employee productivity detail | `/productivity/employee/:email` |
| `ProcessPage.tsx` | Process documentation — index, category, and document views (inline routing) | `/process`, `/process/:category`, `/process/:category/:slug` |
| `ProcessFormPage.tsx` | Create/edit process document with tags | `/process/new`, `/process/:category/new`, `/process/:category/:slug/edit` |

### Components

No module-specific components directory. UI is built directly in the page files using inline components:

- `AttendanceDonut` — defined in `ProductivityPage.tsx` (Recharts PieChart)
- `ProcessIndexView`, `ProcessCategoryView`, `ProcessDocumentView` — defined in `ProcessPage.tsx`

### Hooks (3 files in `src/modules/productivity/hooks/`)

| Hook | Exports | Tables Queried |
|------|---------|----------------|
| `useProductivity.ts` | `useProductivityRecords`, `useProductivitySummary`, `useDepartments`, `usePodProductivity`, `useAvailableWeeks` | `productivity_records`, `departments`, `pods`, `pod_members`, `employee_profiles` |
| `useEmployees.ts` | `useEmployeeProfiles` (unused), `useEmployeeByEmail`, `useEmployeeProductivity` | `employee_profiles`, `productivity_records` |
| `useProcesses.ts` | `useProcessCategories`, `useProcessDocuments`, `useProcessDocument`, `useCreateProcessDocument`, `useUpdateProcessDocument`, `useDeleteProcessDocument` | `process_categories`, `process_documents` |

### Edge Functions

No edge functions are invoked directly from the Productivity module.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `productivity_records` | Weekly productivity data per employee |
| `employee_profiles` | Extended employee information |
| `departments` | Department definitions |
| `pods` | Pod/team definitions |
| `pod_members` | Pod membership |
| `process_documents` | Process documentation content |
| `process_categories` | Process document categories |

## Cross-Module Dependencies

**Depends on:** Platform Core (auth, layouts, UI)
**Used by:** None directly
**Self-contained:** No cross-module imports or exports

## Implementation Status

| Component | Status |
|-----------|--------|
| ProductivityPage (dashboard) | Done |
| Department overview grid | Done |
| Pod breakdown panel | Done |
| Department utilization chart | Done |
| Attendance donut chart | Done |
| Employee table with filters | Done |
| EmployeeDetailPage | Done |
| ProcessPage (index/category/document) | Done |
| ProcessFormPage (create/edit) | Done |
| All hooks (3 files, 14 exports) | Done |

### Known Issues

- `useEmployeeProfiles` hook in `useEmployees.ts` is exported but not imported anywhere
- All components are inline in pages — no extracted component files
- No admin pages in this module (employee management and productivity import are in the Admin module)

### Pending

- Productivity CSV import admin page
- AI productivity insights generation
- Pod health metrics and alerts
- Historical employee trend comparisons
