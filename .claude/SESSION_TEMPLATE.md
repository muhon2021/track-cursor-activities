# Claude Code Session Template

**Use this template structure for EVERY Claude Code session prompt.**

Every session prompt should follow this structure to ensure consistency, completeness, and type safety.

---

## Session Header

```
Control Tower Framework S[N] — [Task Name]
```

Example:

```
Control Tower Framework S18 — PM Dashboard Personalization (Sprint 8.3)
```

---

## Required Sections

### Goal

Clear, concise statement of what we're building and why. 1-2 sentences.

```
Goal
Apply the same personalization (widget visibility + filters) to the PM Dashboard so PMs can
customize their view by pod and project status.
```

### Context

Current state, any blockers, dependencies. Why is this needed now?

```
Context
Sprint 8.1-8.2 completed Owner Dashboard personalization. PM Dashboard needs the same pattern
(useDashboardFilters, DashboardFilterBar, widget visibility preferences). This completes the
personalization feature set.
```

### Files to Create (if any)

List all NEW files that will be created.

```
Files to Create
* None (using existing hooks/components)
```

Or:

```
Files to Create
* src/components/MyNewComponent.tsx
* src/hooks/useMyNewHook.ts
```

### Files to Modify (if any)

List all EXISTING files that will be changed.

```
Files to Modify
* src/pages/dashboards/PMDashboard.tsx
* src/hooks/usePMDashboard.ts
* src/hooks/usePMTeamCapacity.ts
```

### Implementation

Detailed, phase-by-phase breakdown. Include code examples where helpful.

```
Implementation

Phase 1: Update PMDashboard to Support Filters
File: src/pages/dashboards/PMDashboard.tsx

1. Import components:
   import { DashboardFilterBar } from '@/components/dashboards/DashboardFilterBar';
   import { useUserDashboardPreferences } from '@/hooks/useUserDashboardPreferences';

2. Add filter bar and widget visibility gating:
   [detailed code...]

Phase 2: Update Hooks to Filter by Pod
File: src/hooks/usePMDashboard.ts

[detailed changes...]
```

### Testing Checklist

Specific, actionable tests to verify the work.

```
Testing Checklist
* [ ] PMDashboard loads without errors
* [ ] DashboardFilterBar appears at top
* [ ] Selecting a pod filters team capacity + tasks
* [ ] Filter persists across page refresh
* [ ] Widget visibility toggles work
* [ ] "Clear Filters" button works
* [ ] No console errors
```

---

## Pre-Commit Requirements (CRITICAL)

**EVERY session must end with this section. Do not skip.**

```
⚠️ PRE-COMMIT REQUIREMENTS

BEFORE committing, run these checks in order:

1. Automated Checks (Required)
   npm run lint
   npm run build:dev

   If either fails, fix it in this session. Do NOT commit with errors.

2. Manual Type Safety Audit (Required)
   Read .claude/PRE_COMMIT_CHECKLIST.md and verify ALL 6 sections:

   * [ ] Supabase Queries → TypeScript Types
         - Every .select() field exists in the type
         - Joined tables include all selected columns
         - Partial selects use Pick<>

   * [ ] TypeScript Completeness
         - Every Record<K, V> has entries for ALL keys in K
         - No duplicate type exports
         - All enums synced with Record maps

   * [ ] Filter Types → Query Methods
         - Union types (string | string[]) branch with Array.isArray()
         - No filter passed directly to .eq() without validation

   * [ ] Mutation Callbacks
         - Defined in useMutation(), not mutate() call
         - Context type properly inferred

   * [ ] Join Type Audits
         - All uses of join types checked
         - Tests/mocks updated
         - No type mismatches

   * [ ] Enum Usage Audit
         - After adding enum value, ALL Record<EnumType> maps updated

3. Skill Reference (Required)
   Read .claude/skills/type-safety-patterns/SKILL.md and verify code follows:
   * Pattern #1: Supabase Query → TypeScript Type
   * Pattern #2: Record Exhaustiveness
   * Pattern #3: Union Filter Types
   * Pattern #4: Mutation Context Types
   * Pattern #5: Partial Join Selects

4. Commit & Push
   git add .
   git commit -m "Sprint [N]: [Task Name]"
   git push

If Any Check Fails:
   * DO NOT COMMIT
   * Fix the issue in this session
   * Re-run npm run lint + npm run build:dev
   * Re-run manual checklist
   * Then commit

Type safety is non-negotiable. Never merge with TypeScript errors.
```

---

## Quick Reference

**Session Prompt Structure:**

```
Control Tower Framework S[N] — [Task Name]

Goal
[1-2 sentences]

Context
[Current state, blockers, dependencies]

Files to Create
[List or "None"]

Files to Modify
[List or "None"]

Implementation

Phase 1: [Name]
[Detailed steps, code examples]

Phase 2: [Name]
[Detailed steps, code examples]

Testing Checklist
* [ ] Test 1
* [ ] Test 2

⚠️ PRE-COMMIT REQUIREMENTS
[Full pre-commit section — copy from this template]
```
