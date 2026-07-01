# AI Agent Browse System — Complete Design & Implementation Guide

> **Purpose**: This document describes the full AI Agent discovery experience so another developer can replicate it on a different site. It covers every component, color value, layout rule, and interaction pattern.

---

## Table of Contents

1. [Overview & Page Flow](#1-overview--page-flow)
2. [Route Map](#2-route-map)
3. [Data Architecture](#3-data-architecture)
4. [Browse Page — `/agents`](#4-browse-page--agents)
5. [Agent Detail Page — `/agents/:slug`](#5-agent-detail-page--agentsslug)
6. [Dashboard Card — `AITeamsDashboardCard`](#6-dashboard-card--aiteamsdashboardcard)
7. [Contextual Banner — `AgentTeamBanner`](#7-contextual-banner--agentteambanner)
8. [Presence Indicator — `AIAgentPresenceIndicator`](#8-presence-indicator--aiagentpresenceindicator)
9. [Component Tree](#9-component-tree)
10. [Design System & Color Reference](#10-design-system--color-reference)
11. [Replication Guide](#11-replication-guide)

---

## 1. Overview & Page Flow

The AI Agent system follows a **"discovery and documentation" model** — users browse agents, read what they do, then navigate to the functional page where the agent operates. There are no "Run" buttons on discovery pages.

### User Journey

```
Dashboard Card (quick glance)
    │
    ▼
Browse Page /agents (explore all teams & agents)
    │
    ├── Click Team Card → scrolls to Team Detail Section on same page
    │       │
    │       └── Click individual Agent Card → Agent Detail Page
    │
    └── Click "More Agents" card → Agent Detail Page

Agent Detail Page /agents/:slug
    │
    └── "Go to [Section]" CTA → navigates to functional page (e.g. /deals, /meetings/transcripts)
```

### Contextual Entry Points

- **Section pages** (Deals, Meetings, EOS, Projects) show an `AgentTeamBanner` — a collapsible bar with overlapping agent icons
- **Functional pages** show `AIAgentPresenceIndicator` pills — animated pulsing dots that link to the agent detail

---

## 2. Route Map

| Route | Component | Description |
|-------|-----------|-------------|
| `/agents` | `AgentsBrowse` | Main browse page with team grid + individual agents |
| `/agents/:slug` | `AgentDetail` | Individual agent detail page |

Both routes are **protected** (require authentication) and render inside the `DashboardLayout`.

---

## 3. Data Architecture

### Static Config — `agentTeamConfig.ts`

All agent teams and their members are defined in a **static TypeScript config file**. This is the primary data source for the browse experience.

#### TypeScript Interfaces

```typescript
interface AgentTeamAgent {
  name: string;           // Display name, e.g. "Deal Coach"
  slug: string;           // URL slug, e.g. "deal-coach"
  description: string;    // One-line description
  icon: string;           // Lucide icon name, e.g. "Trophy"
  capabilities?: string[];  // List of what the agent does (for detail page)
  howToUse?: string[];      // Step-by-step usage instructions (for detail page)
  whereToFind?: {           // Link to the functional page where agent operates
    label: string;          //   e.g. "Deals Pipeline"
    path: string;           //   e.g. "/deals"
  };
}

interface AgentTeamDef {
  id: string;              // Team key, e.g. "sales"
  name: string;            // Team display name, e.g. "Sales Intelligence Team"
  tagline: string;         // Short description
  accentColor: string;     // Tailwind border class, e.g. "border-b-red-500"
  gradientFrom: string;    // HSL values for gradient start, e.g. "280 70% 50%"
  gradientTo: string;      // HSL values for gradient end, e.g. "330 80% 55%"
  agents: AgentTeamAgent[];
}
```

#### Config Structure

```typescript
const agentTeams: Record<string, AgentTeamDef> = {
  sales: { id: "sales", name: "Sales Intelligence Team", ... agents: [...] },
  meetings: { id: "meetings", name: "Meeting AI Team", ... agents: [...] },
  eos: { id: "eos", name: "Strategy AI Team", ... agents: [...] },
  projects: { id: "projects", name: "Project AI Team", ... agents: [...] },
};

const allTeams = Object.values(agentTeams);
```

#### Helper Functions

```typescript
// Find which team an agent belongs to
findTeamForAgent(slug: string): AgentTeamDef | undefined

// Find an agent + its team by slug
findAgentBySlug(slug: string): { agent: AgentTeamAgent; team: AgentTeamDef } | undefined
```

### Database Supplement — `ai_agents` Table

Agents can also come from the database (`ai_agents` table). The browse page queries this via a `useAIAgents()` hook. DB agents that are **not already in a static team config** appear in a separate "More Agents" section at the bottom.

```typescript
// Filter logic in AgentsBrowse:
const teamSlugs = new Set(allTeams.flatMap(t => t.agents.map(a => a.slug)));
const otherAgents = dbAgents.filter(a => a.is_enabled && !teamSlugs.has(a.slug));
```

---

## 4. Browse Page — `/agents`

**File**: `src/pages/AgentsBrowse.tsx`

### Layout Structure

```
┌──────────────────────────────────────────────────┐
│  Page Header                                      │
│  ✨ AI Agents                                     │
│  Browse and run specialized AI agents...          │
├──────────────────────────────────────────────────┤
│  "Agent Teams" heading                            │
│  ┌──────────────┐  ┌──────────────┐              │
│  │  Team Card    │  │  Team Card    │             │
│  │  (Sales)      │  │  (Meetings)   │             │
│  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐              │
│  │  Team Card    │  │  Team Card    │             │
│  │  (Strategy)   │  │  (Projects)   │             │
│  └──────────────┘  └──────────────┘              │
├──────────────────────────────────────────────────┤
│  Team Detail Section: Sales Intelligence Team     │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                │
│  │Agent│ │Agent│ │Agent│ │Agent│                  │
│  │Card │ │Card │ │Card │ │Card │                  │
│  └─────┘ └─────┘ └─────┘ └─────┘                │
├──────────────────────────────────────────────────┤
│  Team Detail Section: Meeting AI Team             │
│  (same pattern — 4-col grid of agent cards)       │
├──────────────────────────────────────────────────┤
│  ... (Strategy, Projects)                         │
├──────────────────────────────────────────────────┤
│  "More Agents" (DB-only agents, if any)           │
│  4-col grid of AgentBrowseCard                    │
└──────────────────────────────────────────────────┘
```

### Page Header

```tsx
<div>
  <div className="flex items-center gap-3 mb-1">
    <Sparkles className="h-7 w-7 text-primary" />  {/* Electric Blue icon */}
    <h1 className="text-3xl font-bold text-foreground">AI Agents</h1>
  </div>
  <p className="text-muted-foreground text-base">
    Browse and run specialized AI agents across your workspace
  </p>
</div>
```

### Team Card (Summary Card)

**Grid**: `grid-cols-1 md:grid-cols-2 gap-5`

Each Team Card shows:
- **Overlapping icon circles** (up to 4 agents) — uses the team gradient
- **Team name** (xl bold) + tagline (sm muted)
- **"Explore Team" button** — outline, turns primary on hover
- **Bottom accent border** — `border-b-4` with team color class

**Interaction**: Clicking scrolls to the corresponding `TeamDetailSection` via `scrollIntoView({ behavior: "smooth" })` using `id="team-{teamId}"`.

#### Overlapping Icons Pattern

```tsx
<div className="flex -space-x-3 mb-5">
  {previewIcons.map(({ Icon, name }, i) => (
    <div
      key={name}
      className="w-12 h-12 rounded-full flex items-center justify-center ring-3 ring-background shadow-md"
      style={{
        background: `linear-gradient(135deg, hsl(${team.gradientFrom}), hsl(${team.gradientTo}))`,
        zIndex: 4 - i,   // First icon on top
      }}
    >
      <Icon className="h-5 w-5 text-white" />
    </div>
  ))}
</div>
```

**Key CSS**: `ring-3 ring-background` creates a white/dark ring between overlapping circles. `z-index: 4 - i` ensures first icon stacks on top.

### Agent Browse Card (Individual Agent)

Used in Team Detail Sections and "More Agents" grid.

**Grid**:
- Team sections: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
- More Agents: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`

Each card has:
1. **Gradient header strip** — `h-24` with 135deg gradient
2. **Icon circle** — positioned at `-bottom-6 left-5`, overlapping header/body boundary
3. **Name + "By CollabAi"** label
4. **Category badge** (top-right) — colored per category
5. **Description** — `line-clamp-2` for consistent height
6. **"Learn More" button** — full-width outline, turns primary on hover

#### Icon Circle (Overlapping Header/Body)

```tsx
<div className="absolute -bottom-6 left-5 w-12 h-12 rounded-full bg-foreground/90 dark:bg-card
  flex items-center justify-center shadow-lg ring-3 ring-background">
  <IconComponent className="h-6 w-6 text-primary-foreground dark:text-foreground" />
</div>
```

The body has `pt-10` to make space for the overlapping icon.

#### Category Color Map

```typescript
const CATEGORY_COLORS: Record<string, { from: string; to: string; badge: string }> = {
  sales:    { from: "280 70% 50%",   to: "330 80% 55%",  badge: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  meetings: { from: "190 80% 45%",   to: "210 85% 55%",  badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  strategy: { from: "30 90% 50%",    to: "45 95% 55%",   badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  projects: { from: "150 70% 40%",   to: "170 75% 50%",  badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  general:  { from: "199 89% 48%",   to: "187 100% 42%", badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
};
```

#### Icon-to-Slug Mapping

Each agent slug maps to a specific Lucide icon:

```typescript
const iconMap: Record<string, string> = {
  "deal-coach": "Trophy",
  "meeting-summarizer": "FileText",
  "eos-coach": "GraduationCap",
  "project-analyst": "BarChart3",
  "action-item-extractor": "ListChecks",
  "meeting-efficiency-analyzer": "Gauge",
  "client-call-analyzer": "PhoneCall",
  "deal-daily-briefing": "Newspaper",
  "quick-deal-email": "Mail",
  "deal-ai-chat": "MessageSquare",
  "eos-pattern-detective": "Search",
  "eos-pod-health": "HeartPulse",
  "eos-quarterly-digest": "CalendarRange",
  "bug-feature-planner": "Bug",
  "technical-plan-generator": "Cpu",
  "code-review-generator": "Code",
  "lead-followup-research": "Target",
};
// Fallback: "Bot"
```

### Team Detail Section

Each team gets a full section with:
- **Section ID**: `id="team-{teamId}"` with `scroll-mt-24` for scroll offset
- **Team icon** (gradient rounded-xl) + name + tagline
- **4-column grid** of `AgentBrowseCard` components

---

## 5. Agent Detail Page — `/agents/:slug`

**File**: `src/pages/AgentDetail.tsx`

### Data Resolution

1. Try **static config** first: `findAgentBySlug(slug)` → returns `{ agent, team }`
2. Fall back to **database**: `useAIAgents()` → find by slug
3. If neither found → show "Agent not found" with back button

### Layout Structure

```
┌──────────────────────────────────────────────────┐
│  ← All Agents (ghost button)                      │
├──────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────┐  │
│  │        GRADIENT BANNER (h-36 sm:h-44)       │  │
│  │    ○ decorative white circles (opacity 10-20%)│ │
│  ├────────────────────────────────────────────┤  │
│  │  ┌──────┐                                   │  │
│  │  │ ICON │  (20x20 rounded-2xl, -mt-10)      │  │
│  │  └──────┘                                   │  │
│  │  Agent Name (3xl bold)                       │  │
│  │  Badge: "Part of {Team Name}"               │  │
│  │  Description (base, muted, max-w-xl)        │  │
│  │                          [Go to Section →]   │  │
│  └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│  ┌─── Main (2/3) ────────┐ ┌─── Sidebar (1/3) ─┐│
│  │                        │ │                     ││
│  │ Accordion: Capabilities│ │ Card: Built by      ││
│  │  ⚡ What this agent does│ │   CollabAi          ││
│  │  1. capability...      │ │                     ││
│  │  2. capability...      │ │ Card: Team          ││
│  │                        │ │   ✨ Sales Intel..   ││
│  │ Accordion: How to use  │ │                     ││
│  │  📖 How to use it      │ │ Card: Category      ││
│  │  1. step...            │ │   Badge: sales      ││
│  │  2. step...            │ │                     ││
│  │                        │ │ Card: Other agents  ││
│  │ Accordion: Where       │ │   • Daily Briefing  ││
│  │  📍 Where to find it   │ │   • Quick Email     ││
│  │  Link to section       │ │   • Deal AI Chat    ││
│  │                        │ │                     ││
│  └────────────────────────┘ └─────────────────────┘│
└──────────────────────────────────────────────────┘
```

### Hero Section

#### Gradient Banner

```tsx
<div
  className="h-36 sm:h-44 relative"
  style={{
    background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
  }}
>
  {/* Decorative shapes */}
  <div className="absolute inset-0 overflow-hidden">
    <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-20 bg-white" />
    <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full opacity-10 bg-white" />
  </div>
</div>
```

#### Icon Overlay

```tsx
<div
  className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-background -mt-10 relative z-10"
  style={{
    background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
  }}
>
  <IconComponent className="h-9 w-9 text-white" />
</div>
```

**Key**: `ring-4 ring-background` creates separation. `-mt-10` pulls the icon up to overlap the gradient banner.

#### CTA Button (Desktop)

```tsx
<Button
  size="lg"
  className="font-semibold text-white shadow-lg hover:shadow-xl transition-all"
  style={{
    background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
  }}
  onClick={() => navigate(whereToFind.path)}
>
  <ExternalLink className="h-4 w-4 mr-2" /> Go to {whereToFind.label}
</Button>
```

Hidden on mobile (`hidden sm:block`). A separate full-width mobile CTA appears below the hero (`sm:hidden`).

### Content Grid

**Layout**: `grid-cols-1 lg:grid-cols-3 gap-6`

#### Main Column (lg:col-span-2)

Uses `<Accordion type="multiple" defaultValue={["capabilities", "how-to-use", "where"]}>` — all sections open by default.

Each accordion item:
- `border rounded-xl px-5 bg-card shadow-sm`
- Trigger: icon + bold text, `hover:no-underline`
- Content: numbered list with gradient circles (capabilities) or muted circles (steps)

**Capability numbered circles** use the team gradient:

```tsx
<div
  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
  style={{
    background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
  }}
>
  {i + 1}
</div>
```

**Step numbered circles** use muted background:

```tsx
<div className="w-6 h-6 rounded-full flex items-center justify-center bg-muted text-foreground text-xs font-bold">
  {i + 1}
</div>
```

#### Sidebar

Two cards:

1. **Agent Info Card**: "Built by" → CollabAi, "Team" → link with gradient icon, "Category" → badge
2. **Other Agents Card**: List of sibling agents (same team, excluding current). Each row shows a small gradient-tinted icon + agent name, linking to `/agents/{slug}`.

Sidebar agent icons use a **transparent tinted** gradient:

```tsx
style={{
  background: `linear-gradient(135deg, hsl(${gradientFrom} / 0.15), hsl(${gradientTo} / 0.15))`,
}}
```

---

## 6. Dashboard Card — `AITeamsDashboardCard`

**File**: `src/components/dashboards/AITeamsDashboardCard.tsx`

Appears on role-specific dashboards. Shows a horizontally scrollable row of mini team cards.

### Role Filtering

```typescript
type AgencyRole = "owner" | "pm" | "ic";

const ROLE_TEAM_MAP: Record<AgencyRole, string[] | "all"> = {
  owner: "all",                    // Sees all 4 teams
  pm: ["projects", "meetings"],    // Sees 2 teams
  ic: ["projects", "meetings"],    // Sees 2 teams
};
```

### Card Layout

```
┌──────────────────────────────────────────────────┐
│ ┌──┐ Your AI Team                                 │
│ │✨│ 16 specialized agents across 4 teams         │
│ └──┘                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│ │ gradient  │ │ gradient  │ │ gradient  │ │ gradi  ││
│ │ ──────── │ │ ──────── │ │ ──────── │ │ ─────  ││
│ │ ●●●● icons│ │ ●●●● icons│ │ ●●●● icons│ │ ●●●●  ││
│ │ Team Name │ │ Team Name │ │ Team Name │ │ Team  ││
│ │ 4 agents  │ │ 4 agents  │ │ 4 agents  │ │ 4 ag  ││
│ │ Explore → │ │ Explore → │ │ Explore → │ │ Expl  ││
│ └──────────┘ └──────────┘ └──────────┘ └────────┘│
│                              ← scrollable →       │
│ Browse All Agents →                               │
└──────────────────────────────────────────────────┘
```

### Team Mini Card

- `min-w-[240px] flex-shrink-0` — fixed minimum width, horizontal scroll
- `rounded-2xl border border-border border-b-4` with team accent color
- **Top gradient strip**: `h-2` horizontal gradient bar
- **Overlapping icons**: same pattern as browse page but `w-10 h-10`, `ring-2`
- Team name (sm bold) + "{N} agents" count
- "Explore →" text link that animates gap on hover

### Outer Card

- Subtle rainbow gradient overlay at `opacity-[0.03]`
- Border: `border-primary/20`
- "Browse All Agents →" ghost button at bottom

---

## 7. Contextual Banner — `AgentTeamBanner`

**File**: `src/components/ai/AgentTeamBanner.tsx`

A **collapsible banner** placed on section pages (Deals, Meetings, EOS, Projects) to surface the relevant agent team.

### Collapsed State

```
┌──────────────────────────────────────────────────┐
│ ●●●● (overlapping icons)  ✨ Sales Intelligence   ▼│
│                            AI agents that help...  │
└──────────────────────────────────────────────────┘
```

- `rounded-2xl border border-border bg-card border-b-4` with team accent
- Overlapping icons: `w-8 h-8`, `ring-2 ring-background`
- Sparkles icon + team name (sm bold) + tagline (xs muted)
- Chevron toggle (down/up)

### Expanded State

```
┌──────────────────────────────────────────────────┐
│ ●●●● (overlapping icons)  ✨ Sales Intelligence   ▲│
│                            AI agents that help...  │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │AgentTeam│ │AgentTeam│ │AgentTeam│ │AgentTeam│ │
│ │Card     │ │Card     │ │Card     │ │Card     │ │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
└──────────────────────────────────────────────────┘
```

Expanded area shows `AgentTeamCard` components in a horizontally scrollable flex container (`flex gap-3 overflow-x-auto`).

### Usage

```tsx
// On the Deals page:
<AgentTeamBanner team="sales" className="mb-6" />

// On the Meetings page:
<AgentTeamBanner team="meetings" className="mb-6" />
```

---

## 8. Presence Indicator — `AIAgentPresenceIndicator`

**File**: `src/components/ai/AIAgentPresenceIndicator.tsx`

A small **animated pill** placed on functional pages to signal that an AI agent is available.

### Visual Design

```
┌─────────────────────────────────┐
│ ◉ (pulsing)  ✨ (pulsing)  Deal Coach  AI │
└─────────────────────────────────┘
```

- `rounded-full` pill shape
- `border border-border bg-card shadow-sm`
- Border color tinted with team gradient: `borderColor: hsl(${gradientFrom} / 0.3)`
- `animate-fade-in` entrance animation

### Pulsing Dot

```tsx
<span className="relative flex h-2.5 w-2.5">
  <span
    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
    style={{ backgroundColor: `hsl(${gradientFrom})` }}
  />
  <span
    className="relative inline-flex rounded-full h-2.5 w-2.5"
    style={{ backgroundColor: `hsl(${gradientFrom})` }}
  />
</span>
```

Uses Tailwind's built-in `animate-ping` for the expanding ring effect, and a solid dot underneath.

### Sparkles Icon

```tsx
<Sparkles
  className="h-3.5 w-3.5 animate-pulse"
  style={{ color: `hsl(${gradientFrom})` }}
/>
```

### Interaction

Clicking navigates to `/agents/{agentSlug}` (the detail page).

### Usage

```tsx
<AIAgentPresenceIndicator
  agentName="Deal Coach"
  agentSlug="deal-coach"
  gradientFrom="280 70% 50%"
  gradientTo="330 80% 55%"
/>
```

---

## 9. Component Tree

```
App.tsx
├── /agents route
│   └── AgentsBrowse.tsx
│       ├── TeamCard (×4) — summary cards in 2-col grid
│       │   └── Overlapping icon circles
│       ├── TeamDetailSection (×4) — full agent listings
│       │   └── AgentBrowseCard (×N per team) — individual agent cards
│       └── AgentBrowseCard (×N) — "More Agents" from DB
│
├── /agents/:slug route
│   └── AgentDetail.tsx
│       ├── Hero: gradient banner + icon overlay + CTA
│       ├── Accordion: Capabilities, How-To-Use, Where-To-Find
│       └── Sidebar: Info card + related agents card
│
├── Dashboard pages
│   └── AITeamsDashboardCard.tsx
│       └── TeamMiniCard (×N filtered by role) — horizontal scroll
│
├── Section pages (Deals, Meetings, EOS, Projects)
│   └── AgentTeamBanner.tsx
│       └── AgentTeamCard.tsx (×N per team) — horizontal scroll
│
└── Functional pages
    └── AIAgentPresenceIndicator.tsx — animated pill
```

### Shared Dependencies

All components import from:
- `src/components/ai/agentTeamConfig.ts` — team/agent data
- `lucide-react` — `icons` object for dynamic icon lookup + named imports
- `@/components/ui/*` — shadcn/ui primitives (Button, Badge, Card, Accordion)
- `@/lib/utils` — `cn()` class merge utility
- `react-router-dom` — `useNavigate`, `Link`, `useParams`

---

## 10. Design System & Color Reference

### Global Design Tokens (CSS Variables)

```css
:root {
  --primary: 199 89% 48%;           /* Electric Blue */
  --primary-foreground: 0 0% 100%;  /* White */
  --foreground: 222 47% 11%;        /* Deep Navy */
  --muted-foreground: 215 16% 47%;  /* Gray-blue */
  --card: 0 0% 100%;                /* White */
  --border: 214 32% 91%;            /* Light gray */
  --background: 0 0% 100%;          /* White */
  --ai-glow: 199 89% 48%;           /* Electric Blue */
  --ai-pulse: 187 100% 42%;         /* Cyan */
  --radius: 0.75rem;                /* 12px */
}
```

### Team Color Reference

| Team | ID | gradientFrom | gradientTo | accentColor | Badge Style |
|------|----|-------------|-----------|-------------|-------------|
| **Sales Intelligence** | `sales` | `280 70% 50%` (purple) | `330 80% 55%` (pink) | `border-b-red-500` | `bg-pink-100 text-pink-800` |
| **Meeting AI** | `meetings` | `190 80% 45%` (cyan) | `210 85% 55%` (blue) | `border-b-blue-500` | `bg-blue-100 text-blue-800` |
| **Strategy AI** | `eos` | `30 90% 50%` (orange) | `45 95% 55%` (amber) | `border-b-amber-500` | `bg-amber-100 text-amber-800` |
| **Project AI** | `projects` | `150 70% 40%` (green) | `170 75% 50%` (emerald) | `border-b-emerald-500` | `bg-emerald-100 text-emerald-800` |
| **General** (fallback) | — | `199 89% 48%` (electric blue) | `187 100% 42%` (cyan) | — | `bg-cyan-100 text-cyan-800` |

### Card Anatomy

All cards across the system share these patterns:

| Property | Value | Notes |
|----------|-------|-------|
| Border radius | `rounded-2xl` | 16px |
| Border | `border border-border` | Subtle gray |
| Bottom accent | `border-b-4` + team color class | Bold bottom stripe |
| Background | `bg-card` | White / dark card |
| Shadow | `shadow-md` default, `shadow-xl` on hover | Elevation change |
| Transition | `transition-all duration-300` | Smooth hover effect |
| Overflow | `overflow-hidden` | Clip gradient headers |

### Typography

| Element | Classes | Example |
|---------|---------|---------|
| Page title | `text-3xl font-bold text-foreground` | "AI Agents" |
| Section heading | `text-xl font-bold text-foreground` | Team name |
| Card title | `text-lg font-semibold text-foreground` | Agent name |
| Description | `text-sm text-muted-foreground leading-relaxed` | Agent description |
| Badge | `text-[10px] px-2 py-0.5 font-medium` | Category badge |
| "By" label | `text-xs text-muted-foreground` | "By CollabAi" |

### Gradient Application

All gradients use the same pattern:

```tsx
style={{
  background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
}}
```

- **135deg angle** — diagonal top-left to bottom-right
- **HSL format** — values stored as `"H S% L%"` strings, wrapped in `hsl()`
- Applied to: icon circles, banner backgrounds, hero banners, CTA buttons, numbered step circles

### Animations

| Animation | Usage | Definition |
|-----------|-------|------------|
| `animate-fade-in` | Presence indicator entrance | `0%: opacity 0, translateY(10px) → 100%: opacity 1, translateY(0)` |
| `animate-ping` | Pulsing dot in presence indicator | Tailwind built-in — expanding ring |
| `animate-pulse` | Sparkles icon in presence indicator | Tailwind built-in — opacity pulse |
| `animate-ai-pulse` | AI-themed glow effect | Custom: box-shadow oscillation using `--ai-pulse` |
| `animate-ai-glow` | Subtle glow animation | Custom: opacity 0.6 ↔ 1.0 |

### Dark Mode Adjustments

- Badge colors: `dark:bg-pink-900/30 dark:text-pink-300` (etc. per team)
- Icon circle background: `bg-foreground/90 dark:bg-card`
- Icon color: `text-primary-foreground dark:text-foreground`
- All semantic tokens (`text-foreground`, `bg-card`, etc.) automatically adapt

---

## 11. Replication Guide

Step-by-step instructions to recreate this system on another site.

### Step 1: Define the Team Config

Create a config file with your teams and agents:

```typescript
// agentTeamConfig.ts
export interface AgentTeamAgent {
  name: string;
  slug: string;
  description: string;
  icon: string;           // Icon library name
  capabilities?: string[];
  howToUse?: string[];
  whereToFind?: { label: string; path: string };
}

export interface AgentTeamDef {
  id: string;
  name: string;
  tagline: string;
  accentColor: string;    // CSS border color class
  gradientFrom: string;   // HSL values "H S% L%"
  gradientTo: string;     // HSL values "H S% L%"
  agents: AgentTeamAgent[];
}

export const agentTeams: Record<string, AgentTeamDef> = {
  // Define your teams here...
};

export const allTeams = Object.values(agentTeams);

export function findAgentBySlug(slug: string) {
  for (const team of allTeams) {
    const agent = team.agents.find(a => a.slug === slug);
    if (agent) return { agent, team };
  }
  return undefined;
}
```

### Step 2: Build the Browse Page

1. Create a page component at your browse route
2. Map `allTeams` into **Team Cards** (2-col grid) with overlapping icons
3. Below, map each team into a **Team Detail Section** with a 4-col grid of agent cards
4. Each agent card has: gradient header → overlapping icon → name/desc → "Learn More" button
5. Add smooth scroll from team card click to detail section

### Step 3: Build the Detail Page

1. Create a dynamic route `/agents/:slug`
2. Resolve agent from config (or database)
3. Build the hero: gradient banner → overlapping icon → name/badge/description → CTA
4. Build accordion sections: Capabilities, How to Use, Where to Find
5. Build sidebar: metadata card + related agents list

### Step 4: Add Dashboard Card

1. Create a card component for your dashboard
2. Filter teams by user role
3. Render team mini-cards in a horizontal scroll container
4. Link to browse page

### Step 5: Add Contextual Banners

1. Create a collapsible banner component
2. Accept team ID as prop, look up config
3. Show overlapping icons + team name collapsed; agent cards expanded
4. Place on relevant section pages

### Step 6: Add Presence Indicators

1. Create an animated pill component
2. Accept agent name, slug, and gradient colors
3. Add pulsing dot + sparkles icon + agent name
4. Place on functional pages where agents operate

### Step 7: Wire Routes

```tsx
<Route path="/agents" element={<AgentsBrowse />} />
<Route path="/agents/:slug" element={<AgentDetail />} />
```

### Required Libraries

| Library | Purpose |
|---------|---------|
| React Router | Navigation and dynamic routes |
| Lucide React | Icon library with dynamic `icons` object lookup |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Button, Badge, Card, Accordion components |
| tailwindcss-animate | Animation utilities |

---

## Appendix: Full Agent Roster

### Sales Intelligence Team (4 agents)

| Agent | Slug | Icon | Where |
|-------|------|------|-------|
| Deal Coach | `deal-coach` | Trophy | Deals Pipeline |
| Daily Briefing | `deal-daily-briefing` | Newspaper | AI Hub |
| Quick Deal Email | `quick-deal-email` | Mail | Deals & Contacts |
| Deal AI Chat | `deal-ai-chat` | MessageSquare | AI Hub |

### Meeting AI Team (4 agents)

| Agent | Slug | Icon | Where |
|-------|------|------|-------|
| Meeting Summarizer | `meeting-summarizer` | FileText | Meeting Transcripts |
| Action Extractor | `action-item-extractor` | ListChecks | Meeting Detail → Takeaways |
| Efficiency Analyzer | `meeting-efficiency-analyzer` | Gauge | AI Hub |
| Client Call Analyzer | `client-call-analyzer` | PhoneCall | Meeting Transcripts |

### Strategy AI Team (4 agents)

| Agent | Slug | Icon | Where |
|-------|------|------|-------|
| EOS Coach | `eos-coach` | GraduationCap | Strategy Section |
| Pattern Detective | `eos-pattern-detective` | Search | — |
| Pod Health | `eos-pod-health` | HeartPulse | — |
| Quarterly Digest | `eos-quarterly-digest` | CalendarRange | — |

### Project AI Team (4 agents)

| Agent | Slug | Icon | Where |
|-------|------|------|-------|
| Project Analyst | `project-analyst` | BarChart3 | Projects Section |
| Bug & Feature Planner | `bug-feature-planner` | Bug | — |
| Technical Planner | `technical-plan-generator` | Cpu | — |
| Code Reviewer | `code-review-generator` | Code | — |

---

*Document generated from source code as of March 2026. All HSL values, class names, and component structures are exact replicas of the production codebase.*
