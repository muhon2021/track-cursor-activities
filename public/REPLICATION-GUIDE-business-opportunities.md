# Business Opportunities – End-to-End Replication Guide

This document is an **exact structural copy** of the Business Opportunities module so you can replicate the same page and flow in another project. It covers routes, pages, components, hooks, types, database, and configuration.

---

## 1. Route Structure

All routes use `ProtectedRoute` and `DashboardLayout` unless noted. `ErrorBoundary` wraps deal detail routes.

| Path | Component | Layout | Notes |
|------|-----------|--------|--------|
| `/business-opportunities` | `BusinessOpportunities` | DashboardLayout | Main listing with tabs |
| `/business-opportunities/dashboard` | `DealsDashboard` | DashboardLayout | Deals dashboard |
| `/business-opportunities/deals` | `BusinessOpportunities` | DashboardLayout | Same as main (alias) |
| `/business-opportunities/deal/new` | Redirect | — | → `/business-opportunities/create-deal` |
| `/business-opportunities/deals/new` | Redirect | — | → `/business-opportunities/create-deal` |
| `/business-opportunities/create-deal` | `CreateDealPage` | DashboardLayout | New deal form |
| `/business-opportunities/deals/:slug` | `DealDetailPage` | DashboardLayout + ErrorBoundary | Deal detail (default tab) |
| `/business-opportunities/deals/:slug/:tab` | `DealDetailPage` | DashboardLayout + ErrorBoundary | Deal detail with tab |
| `/business-opportunities/deals/:slug/:tab/:agentSlug` | `DealDetailPage` | DashboardLayout + ErrorBoundary | Deal detail + agent |
| `/business-opportunities/deals/:slug/ai-chat` | `DealAIChatPage` | ErrorBoundary only (no DashboardLayout) | AI chat |
| `/business-opportunities/deals/:slug/email-draft-step1` | `DealEmailDraftStep1` | DashboardLayout | Email draft step 1 |
| `/business-opportunities/deals/:slug/email-draft-step2` | `DealEmailDraftStep2` | DashboardLayout | Email draft step 2 |
| `/business-opportunities/deals/:slug/edit` | `EditDealPage` | DashboardLayout | Edit deal |
| `/business-opportunities/deals/:slug/convert-to-win` | `ConvertToWinPage` | DashboardLayout | Convert to win |
| `/business-opportunities/deals/:slug/lovable-build` | `LovableBuildPage` | ProtectedRoute only | Lovable build |
| `/business-opportunities/lead` | `StageDealsLead` | DashboardLayout | Lead stage |
| `/business-opportunities/discovery` | `StageDealsDiscovery` | DashboardLayout | Discovery stage |
| `/business-opportunities/estimation` | `StageDealsEstimation` | DashboardLayout | Estimation stage |
| `/business-opportunities/proposal` | `StageDealsProposal` | DashboardLayout | Proposal stage |
| `/business-opportunities/lost` | `StageDealsLost` | DashboardLayout | Lost stage |
| `/business-opportunities/leads` | `BusinessOpportunityLeads` | DashboardLayout | Leads view |
| `/my-deals` | `MyDeals` | DashboardLayout | My deals |
| `/my-deals/stats` | `MyDealsStats` | DashboardLayout | My deals stats |

**App.tsx imports (order as in project):**

```ts
import BusinessOpportunities from "./pages/BusinessOpportunities";
import DealsDashboard from "./pages/DealsDashboard";
import DealDetailPage from "./pages/deals/DealDetailPage";
import DealAIChatPage from "./pages/deals/DealAIChatPage";
import DealEmailDraftStep1 from "./pages/deals/DealEmailDraftStep1";
import DealEmailDraftStep2 from "./pages/deals/DealEmailDraftStep2";
import LovableBuildPage from "./pages/deals/LovableBuildPage";
import StageDealsLead from "./pages/business/StageDealsLead";
import StageDealsDiscovery from "./pages/business/StageDealsDiscovery";
import StageDealsEstimation from "./pages/business/StageDealsEstimation";
import StageDealsProposal from "./pages/business/StageDealsProposal";
import StageDealsLost from "./pages/business/StageDealsLost";
import ConvertToWinPage from "./pages/business/ConvertToWinPage";
import CreateDealPage from "./pages/business/CreateDealPage";
import EditDealPage from "./pages/business/EditDealPage";
import BusinessOpportunityLeads from "./pages/business/BusinessOpportunityLeads";
import MyDeals from "./pages/MyDeals";
import MyDealsStats from "./pages/MyDealsStats";
import MyBdDeals from "./pages/MyBdDeals";
import BdRepDashboard from "./pages/BdRepDashboard";
// + ErrorBoundary, ProtectedRoute, DashboardLayout, Navigate, useLocation
```

**Legacy redirect component:**

```ts
function LegacyDealNewRedirect() {
  return <Navigate to={`/business-opportunities/create-deal${location.search || ''}`} replace />;
}
```

---

## 2. Main Page: BusinessOpportunities.tsx

**Path:** `src/pages/BusinessOpportunities.tsx`

### 2.1 Page structure (high level)

- **Wrapper:** `<div className="space-y-6 pt-6">`
- **Header:** `PageHeader` with title "Business Opportunities", description "Manage your sales pipeline and track deal progress", `sticky`, and actions (Export, Sync Latest Deals, + New Deal)
- **Main content:** Single `<Tabs>` with `value={mainTab}` and `onValueChange={setMainTab}`

### 2.2 Main tabs (top level)

| Tab value | Label / content |
|-----------|------------------|
| `overview` | Overview – uses `BusinessOpportunitiesOverview` |
| `all` | Active Pipeline – nested stage tabs (All, Lead, Discovery, Qualified, Estimation, Proposal), each rendering `StageTabContent` |
| `archive` | Archive – nested tabs Won / Accepted / Lost, each rendering `StageTabContent` |
| `analytics` | Analytics – `OptimizedDealAnalytics` (or `AnalyticsSkeleton` while loading) |

### 2.3 URL sync (search params)

- `tab` → main tab (`overview` | `all` | `archive` | `analytics`)
- `stage` → stage sub-tab when tab is `all` (e.g. `lead`, `discovery`, `qualified`, `estimation`, `proposal`, or `all`)
- `view` → `card` | `table`
- `quickView` → quick filter (e.g. `all`, `my-deals`, `high-value`, `closing-soon`, `at-risk`)

State is read from URL on mount and whenever `searchParams` change; state is written back with `setSearchParams(..., { replace: true })`.

### 2.4 Stage tab config (Active Pipeline)

Used for both display and tab values. Each entry: `value`, `label`, `icon`, `theme` (trigger, iconWrapper, badge class names).

```ts
const STAGE_TAB_CONFIG: StageTabConfig[] = [
  { value: 'all', label: 'All', icon: TableIcon, theme: { trigger: "...", iconWrapper: "...", badge: "..." } },
  { value: 'lead', label: 'Lead', icon: Users, theme: { ... } },
  { value: 'discovery', label: 'Discovery', icon: Search, theme: { ... } },
  { value: 'qualified', label: 'Qualified', icon: CheckCircle, theme: { ... } },
  { value: 'estimation', label: 'Estimation', icon: Calculator, theme: { ... } },
  { value: 'proposal', label: 'Proposal', icon: FileText, theme: { ... } },
];
```

Valid stage values: `['all', 'lead', 'discovery', 'qualified', 'estimation', 'proposal']`.

### 2.5 Data & hooks (main page)

- **Deals list:** `useDeals(filters)` → `{ data: dealsData, isLoading, error, refetch }`; `allDeals = dealsData?.deals ?? []`, `totalCount = dealsData?.total ?? 0`
- **Analytics (all deals):** `useDeals({ pageSize: 10000, page: 1, sortBy: 'created_at', sortOrder: 'desc' })` → `analyticsDeals`
- **Owners for filters:** `useHubSpotOwners()` → mapped to `{ owner, actual_deal_owner_name }`
- **Stage counts:** `useQuery` with `supabase.rpc("get_deal_stage_counts")` → normalized to `StageCounts` (keyed by stage, count number)
- **Active pipeline count:** `useQuery` – count from `deals` where `deleted_at is null` and `stage in ('lead','discovery','qualified','estimation','proposal')`
- **Closed count:** `useQuery` – count where `stage in ('won','lost','accepted')`
- **Mutations:** `useUpdateDeal()`, `useDeleteDeal()`, and a custom `useMutation` for `hubspot-sync-deals` (sync_mode: 'latest')

### 2.6 Filters state (main page)

- Single `filters` state: `Partial<DealFiltersType>` with defaults `sortBy: 'updated_at'`, `sortOrder: 'desc'`, `page: 1`, `pageSize: 50`
- Handlers: `handleFiltersChange`, `clearFilters`, `handlePageChange`, `handlePageSizeChange`, `handleQuickViewChange`, `toggleSort(column)`

### 2.7 Other behavior

- Real-time: `supabase.channel('deals_changes').on('postgres_changes', { schema: 'public', table: 'deals' }, ...)` invalidates `['deals']` and `['deal-stage-counts']`
- Delete deal: local state `deletingDeal`, `AlertDialog` confirm, then `deleteMutation.mutateAsync(deletingDeal.id)`
- Copy deal link: `window.location.origin + '/business-opportunities/deals/' + (deal.slug || deal.id)`
- Export CSV: headers + rows from `allDeals`, download as CSV file
- Navigation to deal: `navigate('/business-opportunities/deals/' + slug)`
- New deal: `navigate('/business-opportunities/create-deal')`

### 2.8 Imports (main page)

**React / router:** `useState`, `useEffect`, `useMemo`, `useNavigate`, `Link`, `useSearchParams`  
**Data:** `useQuery`, `useQueryClient`, `useMutation` from `@tanstack/react-query`  
**Supabase:** `supabase` from `@/integrations/supabase/client`  
**UI:** `PageHeader`, `StatusBadge`, `ErrorBoundary` (common); `Badge`, `Avatar`, `Button`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Skeleton`, `Table`, `Checkbox`, `Select`, `Progress`, `Tooltip`, `DropdownMenu`, `AlertDialog` (shadcn/ui); Lucide icons (e.g. `Loader2`, `Grid`, `Table as TableIcon`, `Building2`, `Calendar`, `MoreHorizontal`, `Copy`, `Edit`, `Trash2`, `Download`, `FileSpreadsheet`, etc.)  
**Hooks:** `useDeals`, `useUpdateDeal`, `useDeleteDeal`, `DealFilters as DealFiltersType` from `@/hooks/useDeals`; `useAdvancedDeals` from `@/hooks/useAdvancedDeals`; `useHubSpotOwners` from `@/hooks/useOwners`  
**Components (business-opportunity):** `DealFilters`, `FilterPresets`, `ActiveFilterChips`, `AdvancedFiltersDrawer`, `SortableHeader`, `QuickViewsBar`, `EnhancedPagination`, `EnhancedDealCard`, `OptimizedDealAnalytics`, `DealCardSkeletonGrid`, `EmptyDealsState`, `MobileDealCard`, `OwnerDisplay`, `BusinessOpportunitiesOverview`, `DealTableSkeleton`, `DealCardSkeleton`, `AnalyticsSkeleton`, `BulkActions`, `StageTabContent`  
**Types:** `Deal`, `DealStage` from `@/types/database`  
**Utils:** `format` (date-fns), `formatCurrency`, `formatDecimal`, `getClientName` from `@/lib/utils`  
**Other:** `toast` (sonner), `useAuth`, `useToast`

---

## 3. Components (business-opportunity)

**Path:** `src/components/business-opportunity/`

| Component | Purpose |
|-----------|----------|
| `ActiveFilterChips` | Chips for active filters, clear action |
| `AdvancedFiltersDrawer` | Drawer for advanced deal filters |
| `AIScoreCard` | AI score display for a deal |
| `AnalyticsFilters` | Filters for analytics view |
| `AnalyticsSkeleton` | Loading skeleton for analytics |
| `BulkActions` | Bulk action bar (e.g. for selected deals) |
| `BusinessOpportunitiesOverview` | Overview tab: KPI cards, stage breakdown, charts (uses `useDealStats`, `useDeals`, `useAdvancedDeals`, `useHubSpotRevenueProjection`, Recharts) |
| `ClientQuickPreview` | Quick preview of client linked to deal |
| `ConversionFunnelChart` | Funnel chart for deal stages |
| `ConvertClientFolder` | Convert client folder (e.g. Drive) |
| `DataQualityCard` | Data quality metrics |
| `DealAnalytics` | Deal analytics block |
| `DealCardSkeleton` | Single card skeleton |
| `DealCardSkeletonGrid` | Grid of card skeletons |
| `DealFilters` | Main filter bar (search, stage, owner, etc.) |
| `DealKnowledgeSyncCard` | Knowledge sync status for deal |
| `DealTableSkeleton` | Table loading skeleton |
| `EmptyDealsState` | Empty state + CTA (e.g. New Deal) |
| `EnhancedDealCard` | Single deal card (used in grid/list) |
| `EnhancedPagination` | Pagination controls |
| `FilterPresets` | Preset filter buttons |
| `GoogleDriveSyncCard` | Google Drive sync for deal |
| `MobileDealCard` | Mobile-optimized deal card |
| `MonthlyTrendChart` | Monthly trend chart |
| `OptimizedDealAnalytics` | Analytics tab content (charts, tables) |
| `OverviewSkeleton` | Overview tab loading skeleton |
| `OwnerDisplay` | Owner avatar/name display |
| `OwnerPerformanceTable` | Owner performance table |
| `QuickViewsBar` | Quick view toggles (All, My Deals, etc.) |
| `SortableHeader` | Sortable table header |
| `StageTabContent` | Per-stage content: filters, table/card view, pagination, uses `useDeals` with `stages: [stage]` or `stage === 'all'` |
| `StageVelocityChart` | Velocity by stage |
| `TopOwnersCard` | Top owners card |

### 3.1 StageTabContent props

```ts
interface StageTabContentProps {
  stage: DealStage | 'all';
  stageLabel: string;
  viewMode: "card" | "table";
  safeFormatDate: (value?: string | null, fmt?: string) => string;
  onViewDetails: (slug: string) => void;
  owners: { owner: string; actual_deal_owner_name?: string }[];
  onViewModeChange: (mode: "card" | "table") => void;
}
```

Uses `useDeals` with `stages: stage === 'all' ? undefined : [stage]`, `excludeLost`, pagination, sort, search, owner filter. Renders either table or grid of `EnhancedDealCard` + `EnhancedPagination`.

---

## 4. Stage pages (business/)

**Path:** `src/pages/business/`

- **StageDealsPage.tsx** – Generic stage page: `PageHeader`, search, table, inline edit (e.g. POD), pagination. Props: `stage`, `title`, `description`. Used by:
  - **StageDealsLead.tsx** – `stage="lead"`
  - **StageDealsDiscovery.tsx** – `stage="discovery"`
  - **StageDealsEstimation.tsx** – `stage="estimation"`
  - **StageDealsProposal.tsx** – `stage="proposal"`
  - **StageDealsLost.tsx** – `stage="lost"`
- **CreateDealPage.tsx** – Create deal form; on success `navigate('/business-opportunities/deals/' + newDeal.slug)`
- **EditDealPage.tsx** – Edit deal by slug; on success `navigate('/business-opportunities/deals/' + slug)`
- **ConvertToWinPage.tsx** – Convert deal to win flow
- **BusinessOpportunityLeads.tsx** – Leads list; "New Deal" → `/business-opportunities/create-deal`, row click → `/business-opportunities/deals/:slug`

---

## 5. Deal detail & sub-pages (deals/)

**Path:** `src/pages/deals/`

- **DealDetailPage.tsx** – Deal by `:slug`; tabs (e.g. overview, activity, documents); breadcrumb "Business Opportunities" → deal name; uses `useDealBySlug(slug)`, deal comments, related components
- **DealAIChatPage.tsx** – AI chat for deal; breadcrumb Business Opportunities → Deals → deal name → AI Chat
- **DealEmailDraftStep1.tsx** / **DealEmailDraftStep2.tsx** – Email draft wizard; navigation to deal or step2/step1
- **LovableBuildPage.tsx** – Lovable build flow; link back to `/business-opportunities`

---

## 6. Hooks

**Path:** `src/hooks/`

### 6.1 useDeals.ts

- **dealKeys:** `all`, `lists()`, `list(filters)`, `details()`, `detail(id)`, `detailBySlug(slug)`, `stats()`, `comments(dealId)`
- **DealFilters:** search, dealstage, stage, stages, owner, bdRepId, client, client_id, hasClientId, excludeLost, amountMin/Max, dateFrom/To, expectedCloseDateBefore/After, daysInStageMin/Max, sortBy, sortOrder, page, pageSize
- **PaginatedDeals:** deals, total, page, pageSize, totalPages
- **DealStats:** totalDeals, totalValue, avgProbability, weightedValue, byStage
- **Exports:** `useDeals(filters)`, `useDeal(id)`, `useDealStats()`, `useDealBySlug(slug)`, `useDealComments(dealId)`, `useUpdateDeal()`, `useDeleteDeal()`, `useCreateDeal()`, and other deal mutations/helpers

### 6.2 useDealStageCounts.ts

- **useDealStageCounts()** – `useQuery` with `supabase.rpc('get_deal_stage_counts')`, returns `{ lead, discovery, estimation, proposal, all }` (and optionally other stages if you extend the RPC or mapping).

### 6.3 useOwners.ts

- **useHubSpotOwners()** – Returns HubSpot owners (e.g. for owner filter dropdown).

### 6.4 Other deal-related hooks

- `useAdvancedDeals` – Advanced deal list/analytics
- `useDealCoach(dealId)`
- `useDealChatSessions(dealId)`
- `useDealAIScore(dealId)`
- `useDealDuplicates`, `useDealDriveFiles`, `useDealKnowledgeSync`, `useDealMeetings`, `useDealEngagements`, `useDealMatching`, `useDealQuickEmail`, `useDealChatContext`, `useDealMemory`, `useDealStageChanges`, `useDealCycleStats`, `useUpdateDealField`, `useSyncAllDeals`, `useBulkDealSync`, `useDealSyncQueue`, `useDealsWithRecentComments`, `useDealsQueueStatus`, `usePauseDealsQueue`, etc.

---

## 7. Types

### 7.1 DealStage (database)

**Path:** `src/types/database.ts` (and re-exported from `database-custom` if used)

```ts
export type DealStage =
  | "lead"
  | "discovery"
  | "qualified"
  | "estimation"
  | "proposal"
  | "accepted"
  | "won"
  | "lost";
```

`normalizeDealStage(stage)` maps unknown/empty to `"lead"`.

### 7.2 Deal / DealFilters (app)

**Path:** `src/types/deals.ts` and `src/hooks/useDeals.ts`

Deal: id, slug, hubspot_deal_id, deal_name, client, client_id, stage, owner, actual_deal_owner_*, value, probability, expected_close_date, created_at, updated_at, pod_assigned, lead_source, dealtype, category, etc.  
DealFilters: see §6.1.

### 7.3 Supabase `deals` table (Row)

Key columns: id, deal_name, client, stage, value, probability, owner, actual_deal_owner_email, actual_deal_owner_id, actual_deal_owner_name, expected_close_date, created_at, updated_at, deleted_at, created_by, updated_by, client_id, slug, hubspot_deal_id, days_in_stage, next_step, pod_assigned, category, dealtype, bd_rep_id, project_id, and many optional URL/contact fields.

---

## 8. Database & RPC

### 8.1 Table: deals

Use the schema from `src/integrations/supabase/types.ts` under `deals.Row` (and Insert/Update) for replication. RLS and policies should restrict visibility by role/POD/ownership as in the existing project.

### 8.2 RPC: get_deal_stage_counts

**Path:** e.g. `supabase/migrations/20251202130500_add_get_deal_stage_counts.sql`

```sql
create or replace function public.get_deal_stage_counts()
returns table(stage text, count bigint)
language sql
security definer
stable
as $$
  select
    lower(coalesce(stage, 'unknown')) as stage,
    count(*)::bigint as count
  from public.deals
  where deleted_at is null
  group by lower(coalesce(stage, 'unknown'));
$$;

grant execute on function public.get_deal_stage_counts() to authenticated, anon, service_role, supabase_admin;
```

---

## 9. Navigation & audit data

### 9.1 urlAuditData.ts

**Path:** `src/data/urlAuditData.ts`

- Entry: `path: "/business-opportunities"`, `label: "Business Opportunities"`, `icon: Target`, `category: "module-protected"`, `module: "business-opportunities"`, `description: "Deal pipeline and opportunities"`
- Children: `/business-opportunities/deals` (All Deals), `/business-opportunities/lead`, `/discovery`, `/estimation`, `/proposal`, `/lost` (same module)
- Separate entry for `/my-deals` (module `business-opportunities`)

### 9.2 navigationStructure.ts

**Path:** `src/data/navigationStructure.ts`

- Section "Business Opportunities": `path: "/business-opportunities"`, `icon: Briefcase`, `moduleName: "Business Opportunities"`
- Children: Deals Dashboard (`/business-opportunities/dashboard`), All Deals (`/business-opportunities`), Lead, Discovery, Estimation, Proposal (same paths as above)
- "My Deals" under Business Development: `path: "/my-deals"`, `moduleName: "Business Opportunities"`

### 9.3 MainSidebar

**Path:** `src/components/layout/MainSidebar.tsx`

- `useDealStageCounts()` for badge counts
- `stageCountMap`: `/business-opportunities` → `dealCounts?.all`, `/business-opportunities/lead` → `dealCounts?.lead`, same for discovery, estimation, proposal

---

## 10. Edge functions (optional for replication)

- `hubspot-sync-deals` – Sync deals from HubSpot (e.g. sync_mode: 'latest')
- `hubspot-sync-all-deals`, `hubspot-process-single-deal`, `hubspot-link-deals-to-clients`
- `match-deal-to-client`, `api-v1-deals`
- `deal-ai-chat`, `deal-coach`, `ai-score-deal`
- `send-deal-assignment-notification`, `send-deal-comment-notification`, `handle-comment-mentions`

Deal URLs in notifications: `${APP_URL}/business-opportunities/deals/${deal_slug}`.

---

## 11. Common components used

- **PageHeader** – `@/components/common/PageHeader` (title, description, actions, sticky, etc.)
- **StatusBadge** – `@/components/common/StatusBadge`
- **ErrorBoundary** – `@/components/common/ErrorBoundary`
- **KPICard** – `@/components/common/KPICard` (e.g. in overview)
- shadcn: Button, Tabs, Table, Card, Badge, Avatar, Select, Input, Checkbox, Progress, Tooltip, DropdownMenu, AlertDialog, Skeleton

---

## 12. Replication checklist

1. **Routes:** Add all routes from §1 in App.tsx with correct components and wrappers.
2. **Pages:** Copy `BusinessOpportunities.tsx`, `DealsDashboard.tsx`, `MyDeals.tsx`, `MyDealsStats.tsx`, and all under `pages/business/` and `pages/deals/` (or adapt paths).
3. **Components:** Copy `src/components/business-opportunity/*` and any deal-specific components under `src/components/deals/` and `src/pages/deals/components/`.
4. **Hooks:** Copy `useDeals.ts`, `useDealStageCounts.ts`, and any other deal hooks you need; keep `dealKeys` and filter types in sync.
5. **Types:** Copy `DealStage`, `normalizeDealStage`, and Deal/DealFilters from `types/database.ts` and `types/deals.ts` (or merge into your types).
6. **DB:** Create `deals` table (and related) from your Supabase types; add RPC `get_deal_stage_counts`; configure RLS.
7. **Nav:** Add Business Opportunities and My Deals entries to `urlAuditData.ts` and `navigationStructure.ts`; wire sidebar counts with `useDealStageCounts`.
8. **Integrations:** If you need HubSpot, deploy the listed edge functions and configure credentials; otherwise stub or remove sync/notifications.

---

**Document version:** 1.0  
**Last updated:** February 12, 2026  
**Source:** SJ Control Tower – Business Opportunities module
