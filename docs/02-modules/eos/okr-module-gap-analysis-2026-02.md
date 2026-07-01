# OKRs Module Gap Analysis (Against Replication Guide v1.0)

_Date_: 2026-02-11  
_Scope reviewed_: EOS OKR implementation in this repository (database, edge functions, frontend, admin integration, AI/agent coverage)

## Executive Summary

The OKRs capability **exists** in this codebase, but it is **not yet at 100% parity** with your replication guide.

Current implementation is a strong EOS-integrated baseline (OKRs list/detail, key results, check-ins, close flow, health/by-pod/by-owner/closed views, and one AI suggestion function), but there are meaningful schema, feature, and admin parity gaps.

**Estimated parity vs target guide**: **~70–78%**

## Direct Comparison to Your Original Replication Checklist ("What is left")

Legend: ✅ done, 🟡 partial, ❌ not done

### Phase 1: Database
- ❌ Create enums: `okr_status`, `okr_type`, `measurement_unit`, `update_frequency` (current EOS schema uses text/check constraints with different status model).
- 🟡 Create core tables: implemented as `okrs`, `okr_key_results`, `okr_check_ins`; missing `key_result_history` and naming/field parity.
- 🟡 Add all indexes: baseline indexes exist; not full parity with target schema/index set.
- ❌ Helper functions: `calculate_next_update_due()` and `calculate_key_result_progress()` not present.
- ❌ RLS parity: current policies are broad; not owner/responsible/admin policy model from spec.
- ❌ Run 2 target migrations in order: migration filenames and content differ from provided guide.

### Phase 2: Backend (Edge Functions)
- ✅ `analyze-okr-progress` implemented.
- ✅ `okr-update-reminder` implemented.
- ✅ `suggest-okrs` now supports `type`/`count` and returns `success` + `okrs` with backward-compatible `suggestions`.
- ❌ Cron for reminders and outbound email execution are still not implemented/configured end-to-end for OKR flow.

### Phase 3: Frontend Pages & Routes
- 🟡 Main OKRs page exists and route `/okrs` exists, but tab model/feature coverage is not full parity.
- 🟡 Navigation entry exists, but structure differs from your exact target information architecture.

### Phase 4: Components & Hooks
- 🟡 Components exist for core OKR workflows, but not the full 22-component target set.
- ❌ Missing hooks from target: `useOKRPermissions`, `useKeyResultHistory`, `useKeyResultLastUpdates`.
- ❌ Missing admin employee `OKRsTab` integration specified in your guide.
- ❌ Missing target file structure parity for `src/types/okr.ts` and `src/utils/okrHelpers.ts`.

### Phase 5: Integration
- 🟡 Module wiring exists under EOS and OKRs is accessible, with a new admin OKRs workspace; however full permissions + AI operational integration remains incomplete.
- ❌ Full app_modules + admin workflow parity for the standalone OKR replication target is not complete.

### Phase 6: Testing
- ❌ End-to-end parity test matrix from your guide is not fully implemented/executed (AI health, reminders, overdue logic, full role model).

### Requested extras from your message (admin + edge + AI agent)
- 🟡 Admin panel OKR management moved forward with `/admin/eos/okrs`, but employee-tab integration and policy settings are still missing.
- ✅ Missing OKR edge functions were added (`analyze-okr-progress`, `okr-update-reminder`).
- ❌ OKR-specific AI-agent workflow copy/seed + operations hardening is not yet completed.

---

## What Already Exists (Confirmed)

### Database / data model
- `okrs`, `okr_key_results`, and `okr_check_ins` tables exist in EOS migration with indexes and RLS enabled.
- OKR routing and front-end data layer are already wired to these tables.

### Frontend
- Dedicated OKRs page exists at `/okrs` with tabs for cards, health, by-pod, by-owner, and closed.
- Existing OKR component set includes: card, create dialog, check-in dialog, close dialog, health grid, by-owner, by-pod, closed table, and progress chart.
- Navigation already includes an OKRs entry under Strategy (EOS).

### Backend / AI
- `suggest-okrs` edge function exists and is live in repo (with normalized `okrs` response support).
- `analyze-okr-progress` and `okr-update-reminder` edge functions now exist.
- AI provider routing is used for OKR suggestion/analysis paths.

---

## Gap Analysis by Replication Phase

## 1) Database Gap

### ✅ Present
- Core table coverage is partially present: `okrs`, key results table, and check-ins table.
- Basic indexing and RLS are present.

### ❌ Missing or mismatched vs spec
1. **Table naming mismatch**
   - Spec expects: `key_results`, `okr_updates`, `key_result_history`
   - Current uses: `okr_key_results`, `okr_check_ins`, and has **no dedicated history table**.

2. **Critical columns missing (or different) in `okrs`**
   - Missing / different: `type` (company/team/personal), `due_date` (currently `end_date`), `quarter_year`, `health_score`, `health_status`, `ai_health_notes`, `ai_recommendations`, `is_active`.
   - `status` enum values differ (`draft/active/behind/...` vs spec states `planned/in_progress/...`).

3. **Critical columns missing in key results**
   - Missing / different: `measurement_unit` + `custom_unit` model, `responsible_user_id`, `update_frequency`, `last_updated_at`.

4. **No audit table for KR value changes**
   - `key_result_history` required by guide is not present.

5. **Missing helper SQL functions from spec**
   - `calculate_next_update_due()` and `calculate_key_result_progress()` are not defined in EOS migration.

6. **RLS policy granularity mismatch**
   - Current RLS is permissive for most EOS tables (`FOR ALL ... USING (true)`), not the owner/responsible/admin granularity required by guide.

---

## 2) Edge Functions Gap

### ✅ Present
- `suggest-okrs` exists and now supports target-friendly payload (`type`, `count`, `success`, `okrs`) with backward compatibility.
- `analyze-okr-progress` function exists (deterministic + AI-assisted health response).
- `okr-update-reminder` function exists (owner-grouped overdue payload).

### ❌ Missing
1. Cron schedule + reminder dispatch pipeline (email send + dedupe persistence) tied to update frequency/grace period.
2. Optional periodic health-analysis automation job (daily/weekly) remains unconfigured.

---

## 3) Frontend Gap (Main OKRs UX)

### ✅ Present
- Core `/okrs` page, multiple tabs, create/check-in/close workflows, and detail dialog.

### ❌ Missing or below parity
1. **Tab taxonomy mismatch**
   - Spec requires explicit My / Team / Company / Health / Performance / Closed structure.
   - Current uses Cards / Health / By Pod / By Owner / Closed.

2. **Feature count mismatch**
   - Guide references 22 OKR components and 3 hooks; current dedicated OKR component count is ~10 and hook count is 1.

3. **Missing feature-specific components/workflows**
   - No dedicated key result history entry management dialogs (`AddEntryDialog`, `EditEntryDialog`, entries tab pattern as described).
   - No dedicated overdue member indicator tied to `update_frequency` + `last_updated_at`.
   - No dedicated AI suggestions dialog component matching guide contract.

4. **Type and utility structure mismatch**
   - Spec expects `src/types/okr.ts` and `src/utils/okrHelpers.ts` utilities; current types are in EOS shared type file and helper suite is not at parity with requested API.

---

## 4) Admin Panel Gap

### ✅ Present
- Admin EOS area exists, including VTO, scorecards, accountability, and a dedicated OKRs workspace (`/admin/eos/okrs`).

### ❌ Missing (important to your request)
1. No `OKRsTab` integration under admin employee detail tabs as described.
2. No admin OKR policy/settings UI (frequency defaults, quarter configuration, reminder behavior, AI toggles).
3. No full approval workflow controls embedded directly into OKR actions (company/team OKR approval gating).

---

## 5) AI Agent / Agent-First Integration Gap

### ✅ Present
- AI infrastructure and agent tooling exists in repository.
- `suggest-okrs` uses shared AI routing.

### ❌ Missing for full “agent-first” OKR parity
1. No dedicated agent workflow for periodic OKR health analysis write-back.
2. No agent-driven reminder pipeline for overdue KR updates.
3. No explicit OKR-specific AI agent definitions/seeding for admin-configurable behavior (if desired under AI Command Center).
4. No 24h cache layer for AI health scoring results (recommended in guide).

---

## Approval Process Status (User Approval / HITL)

### ✅ What exists globally
- Platform-level HITL approval system exists (`approval_workflows`, `approval_requests`, `approval_delegations`) with request/respond edge functions and hooks.
- Role/delegation-aware approval decisioning is implemented in approval endpoints.

### ❌ What is still missing for OKR module parity
1. OKR flows do not currently invoke approval requests (e.g., create/edit/close company or team OKRs).
2. No OKR-specific approval workflow presets (e.g., company OKR requires executive approval).
3. No OKR UI state for “pending approval / approved / rejected” lifecycle.
4. No linkage between OKR records and `approval_requests` for audit traceability in module screens.

### Recommendation for approval completion
- Add approval gating only for high-impact actions first (company/team OKR create, close, and owner reassignment), then expand to optional check-in approvals.
- Reuse existing `request-approval` / `respond-to-approval` infrastructure to avoid new abstractions and keep rollout low risk.

---

## Task Plan to Reach 100% Capability

## Phase A — Data Foundation (must be first)
1. Create migration to align/extend schema with replication model:
   - Add missing OKR columns (`type`, `due_date`, `quarter_year`, health/AI fields, `is_active`).
   - Add KR columns (`measurement_unit`, `custom_unit`, `responsible_user_id`, `update_frequency`, `last_updated_at`).
   - Add `key_result_history` and `okr_updates` compatibility strategy (rename vs view vs new table).
2. Add SQL helper functions:
   - `calculate_next_update_due()`
   - `calculate_key_result_progress()`
3. Add migration-safe backfill scripts for existing rows.
4. Harden RLS policies to owner/responsible/admin rules.

## Phase B — Edge Functions + AI Contracts
5. ✅ Validate and harden `analyze-okr-progress` (cache window, retries, observability, and UI wiring).
6. ✅ Complete `okr-update-reminder` production path (email dispatch integration, dedupe persistence, and schedule management).
7. Update `suggest-okrs` to support required request/response contract while preserving backward compatibility.
8. Add cron config docs + SQL for weekly reminders and optional health analysis schedule.

## Phase C — Frontend Parity
9. Refactor OKRs page IA to My / Team / Company / Health / Performance / Closed tabs.
10. Add missing OKR hooks:
   - `useOKRPermissions`
   - `useKeyResultHistory`
   - `useKeyResultLastUpdates`
11. Add missing components and entry/history workflows:
   - KR history list + add/edit dialogs
   - Overdue indicators
   - AI suggestions dialog with new contract
12. Add dedicated OKR types + helper utilities at requested paths (or provide alias exports with migration plan).

## Phase D — Admin Panel Completion
13. ✅ Expand `/admin/eos/okrs` workspace from baseline to full parity (ownership reassignment, archive controls, and advanced status ops).
14. Add admin employee OKR tab integration (`OKRsTab`) with summary metrics and linked detail.
15. Extend admin EOS system settings for OKR defaults (quarter behavior, update frequencies, reminder grace, AI enablement).

## Phase E — AI Agent Copy / Operations Hardening
16. Add OKR-focused agent configuration/seeds (health analyst, reminder assistant, planner assistant).
17. Add observability:
   - function logs
   - token usage capture
   - retry/error dashboards for reminder and analysis jobs.
18. Add 24h AI analysis caching and invalidation on KR updates.

## Phase F — Validation & Go-Live
19. End-to-end QA matrix for all 6 tabs + CRUD + check-ins + close flow + role checks.
20. Run cron dry-run + email reminder validation in staging.
21. Run migration rollback test and release notes for existing EOS tenants.
22. Configure OKR-specific approval workflows and test manager/executive approval SLAs.

---

## Priority “Do This First” List (if you want fastest business impact)

1. Schema extension + backfill + RLS hardening.
2. `analyze-okr-progress` + `okr-update-reminder` edge functions.
3. Admin OKR workspace and employee OKR admin tab.
4. Frontend IA parity + missing hooks (permissions/history/overdue).
5. Agent workflows + caching + operational telemetry.

---

## Risk Notes

- **Breaking change risk**: Renaming current tables directly (`okr_key_results` → `key_results`, `okr_check_ins` → `okr_updates`) can break existing app code. Prefer additive migration + compatibility views, then phased code migration.
- **RLS tightening risk**: Current broad RLS may hide latent permission dependencies; add policy tests before production rollout.
- **AI dependency risk**: Ensure env setup (`OPENAI` keys / provider config) before enabling hard dependencies in core UI.

---

## Recommendation

Proceed with a **2-sprint rollout**:
- **Sprint 1**: Data + edge functions + admin foundations
- **Sprint 2**: Full frontend parity + agent workflows + QA hardening

This gives the fastest path to business value (reliable OKR operations and leadership visibility) while minimizing regression risk.
