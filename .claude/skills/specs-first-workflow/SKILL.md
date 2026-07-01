---
name: specs-first-workflow
description: "Specs-first development. No code without specs. Triggers: new feature, implement, build, create, add, specification, plan, design."
---

# Specs-First Development Workflow

**RULE: No code without specs. Every new feature must have a specification document before implementation begins.**

## When This Applies

- Any new feature or module
- Any significant enhancement to existing features
- Any database schema change
- Any new Edge Function or API endpoint
- Any new page or major UI component

## When This Does NOT Apply

- Bug fixes (use sj-bug-fix-workflow instead)
- Minor UI tweaks (color, spacing, text changes)
- Refactoring (no behavior change)
- Dependency updates

## Spec Template

Create spec documents in `/docs/` using this template:

```markdown
# Feature: [Feature Name]

> One-line description of what this feature does

**Status**: Draft | Review | Approved | In Progress | Complete
**Module**: [platform | eos | meetings | projects | actions | business-dev | lead-followup | knowledge | productivity | admin]
**Author**: [name]
**Date**: [YYYY-MM-DD]

## Overview

[2-3 paragraphs describing the feature, its purpose, and who benefits from it]

## User Stories

- As a [role], I want to [action] so that [benefit]
- As a [role], I want to [action] so that [benefit]

## Database Design

### New Tables

| Table | Purpose |
|-------|---------|
| `table_name` | Description |

### Table: table_name
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | No | gen_random_uuid() | Primary key |
| user_id | UUID | No | — | Owner |
| ... | ... | ... | ... | ... |
| created_at | TIMESTAMPTZ | No | now() | Created timestamp |
| updated_at | TIMESTAMPTZ | No | now() | Updated timestamp |

### RLS Policies
- SELECT: Users can view own records
- INSERT: Users can create own records
- UPDATE: Users can update own records
- DELETE: Users can delete own records
- ALL: Admins can manage all records

### Schema Changes to Existing Tables
[List any ALTER TABLE changes needed]

## API Design

### Edge Functions

#### [function-name]
- **Method**: GET | POST | PUT | DELETE
- **Auth**: JWT required
- **Request Body**:
  ```json
  { "field": "type — description" }
  ```
- **Response**:
  ```json
  { "data": { ... }, "status": "success" }
  ```
- **Error Codes**: 400, 401, 404, 500

## UI Design

### Pages
| Route | Component | Description |
|-------|-----------|-------------|
| /feature | FeaturePage.tsx | Main list view |
| /feature/:id | FeatureDetail.tsx | Detail view |
| /feature/new | FeatureForm.tsx | Create form |

### Components
- `FeatureList` — displays paginated list with filters
- `FeatureCard` — individual item card
- `FeatureForm` — create/edit form with Zod validation
- `FeatureFilters` — filter bar (status, date, search)

### States
- **Loading**: Spinner centered in content area
- **Empty**: Message with icon + CTA button
- **Error**: Toast notification with retry option
- **Success**: Toast confirmation

## Validation

### Form Schema (Zod)
```typescript
const featureSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]),
});
```

## Feature Flags

- Module: [module-id]
- Feature flag: [flag name in app_config, if needed]
- Build-time toggle: VITE_MODULE_[NAME]

## Testing Plan

- [ ] Unit tests for validation schema
- [ ] Hook tests for data fetching
- [ ] Component tests for form submission
- [ ] RLS policy tests for data isolation
- [ ] Edge Function tests for API contract
- [ ] Manual QA checklist

## Migration Plan

[Steps for deploying to production]
1. Apply database migration
2. Deploy Edge Functions
3. Update feature flags
4. Deploy frontend

## Dependencies

- Depends on: [list modules or features this depends on]
- Blocks: [list features that depend on this]

## Open Questions

- [ ] [Question that needs to be resolved before implementation]
```

## Spec Location

Place specs in the appropriate docs folder:
- New module: `docs/02-modules/[module-name].md`
- New feature within module: `docs/02-modules/[module-name]/[feature].md`
- Architecture change: `docs/01-architecture/[topic].md`
- Integration: `docs/05-integrations/[provider].md`
- Edge Function: `docs/08-edge-functions/[function].md`

## Status Indicators

Use these consistently across all specs and documentation:

| Icon | Status |
|------|--------|
| ✅ | Complete — implemented and tested |
| 🔄 | In Progress — actively being worked on |
| ❌ | Planned — not yet started |
| ⚠️ | Blocked — has dependencies or issues |

## Lovable Handoff Format

When handing off UI implementation to Lovable, provide:

1. **Component tree** — visual hierarchy of components
2. **Data props** — exact prop types for each component
3. **State management** — which hooks to use, what data to fetch
4. **Design references** — existing similar components in the project to match
5. **Routing** — exact route paths and parameters
6. **Form fields** — all fields with labels, types, validation rules
7. **API calls** — which Edge Functions to call, request/response shapes

## Workflow Steps

1. **Write spec** → create document following template above
2. **Review spec** → verify completeness (all sections filled)
3. **Check dependencies** → ensure dependent modules/tables exist
4. **Approve** → mark status as "Approved"
5. **Implement** → follow spec exactly
6. **Verify** → check implementation matches spec
7. **Update spec** → mark status as "Complete", note any deviations

**Never deviate from the spec without updating the spec first.**
