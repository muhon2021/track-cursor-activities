# Feature: Four Spaces Information Architecture

> Reorganize navigation into four role-focused workspaces with contextual sidebars, space switcher, and backward-compatible routes.

**Status**: Approved  
**Module**: platform  
**Author**: SJ Control Tower Team  
**Date**: 2026-06-18

## Overview

The application currently uses two layout shells (DashboardLayout + AdminLayout) with ~185 routes split across a large main sidebar and a separate admin sidebar. This creates duplicate surfaces, deep nesting, and poor discoverability.

This feature introduces four primary **Spaces** — Sales, Knowledge, Operations, and EOS — each with its own dashboard, contextual sidebar, and URL prefix. Legacy routes redirect to new paths. Space visibility respects module access, agency roles, EOS flags, and enterprise RBAC permissions.

## User Stories

- As a sales user, I want a focused Sales workspace so that I can find CRM tools without admin clutter.
- As a knowledge admin, I want all AI and knowledge tools in one space so that I can manage sources and search from one place.
- As an operations admin, I want user management and integrations together so that I can administer the platform efficiently.
- As a leadership user, I want EOS tools including meetings in one space so that strategic execution is centralized.
- As any user, I want my bookmarks and recently visited pages pinned in the sidebar so that I can navigate faster.

## Database Design

### New Tables

| Table | Purpose |
|-------|---------|
| `user_space_preferences` | Per-user default space, favorites, recent pages |

### Table: user_space_preferences

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | No | gen_random_uuid() | Primary key |
| user_id | UUID | No | — | FK auth.users |
| default_space | TEXT | No | sales | sales, knowledge, operations, eos |
| favorites | JSONB | No | [] | [{ title, href, spaceId, icon }] |
| recent_pages | JSONB | No | [] | [{ title, href, spaceId, visitedAt }] |
| updated_at | TIMESTAMPTZ | No | now() | Last update |

RLS: users can SELECT/INSERT/UPDATE own row only.

## Space Definitions

| Space | Prefix | Target Users | Visibility |
|-------|--------|--------------|------------|
| Sales | /sales | BD, CS, executives | business-dev module |
| Knowledge | /knowledge | Knowledge, AI, PMO | knowledge module OR AI flags |
| Operations | /operations | Admins, ops, PMO | admin permissions OR owner/pm agency role |
| EOS | /eos | Leadership | eos module + isEosUser OR admin |

Meetings module lives **only in EOS Space** (user decision). Missing spec pages (Revenue Analytics, Billing, People Analyzer, etc.) are **omitted** — map to existing pages only.

## Acceptance Criteria

1. Space switcher shows only spaces the user can access.
2. Sidebar shows only current space navigation + favorites + recents.
3. All legacy `/admin/*`, `/clients`, `/meetings/*`, etc. redirect to new paths.
4. `user_space_preferences` persists favorites and default space.
5. Global search finds pages across visible spaces.
6. Breadcrumbs show `{Space} Space > {Page}`.
7. Feature flag `enableFourSpaces` toggles new layout; rollback preserves old layout.
8. ModuleRoute enforces per-user module access (not sidebar-only).

## Out of Scope

- Placeholder pages for unbuilt features
- Org-level billing page
- Deleting legacy route definitions (Phase 5 of migration)
