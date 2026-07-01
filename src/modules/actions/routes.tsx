/**
 * Actions Module Routes
 *
 * Standalone task management with streams, views, and detail pages.
 * Gated by the "actions" module / "enableTasks" feature flag.
 *
 * Routes:
 *   /tasks – Main "My Tasks" page (tabs: Today, This Week, Overdue, Delegated, All Tasks, Streams)
 *   /streams – Browse all task streams (grid; click → /tasks/stream/:slug)
 *   /tasks/stream/:slug – Stream-scoped task list
 *   /tasks/:idOrSlug – Task detail (UUID or slug; prefer slug in URLs)
 * Legacy: /tasks-v2 → /tasks, /tasks/t/:slug → /tasks/:slug, /tasks/streams → /streams, /tasks/streams/:id → /tasks/stream/:slug
 */
import { Route, Navigate } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";

// Module-owned pages
import TasksPage from "./pages/TasksPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import StreamsPage from "./pages/StreamsPage";
import StreamTasksPage from "./pages/StreamTasksPage";

// Legacy: redirect components
import { TaskDetailRedirect } from "./components/TaskDetailRedirect";
import { StreamRedirect } from "./components/StreamRedirect";
import { TaskEditRedirect } from "./components/TaskEditRedirect";

export const actionsRoutes = (
  <Route element={<ModuleRoute module="actions" requiresFeatureFlag="enableTasks" />}>
    {/* Main tasks page */}
    <Route path="/tasks" element={<TasksPage />} />
    {/* Browse streams (standalone) */}
    <Route path="/streams" element={<StreamsPage />} />
    {/* Stream-scoped task list (by slug) */}
    <Route path="/tasks/stream/:slug" element={<StreamTasksPage />} />
    {/* Task detail: idOrSlug (UUID or slug) */}
    <Route path="/tasks/:idOrSlug" element={<TaskDetailPage />} />

    {/* Legacy redirects */}
    <Route path="/tasks-v2" element={<Navigate to="/tasks" replace />} />
    <Route path="/tasks/t/:slug" element={<TaskDetailRedirect />} />
    <Route path="/tasks/streams" element={<Navigate to="/streams" replace />} />
    <Route path="/tasks/streams/:id" element={<StreamRedirect />} />
    {/* Legacy task form routes - keep for bookmarks; redirect edit to detail */}
    <Route path="/tasks/new" element={<Navigate to="/tasks" replace />} />
    <Route path="/tasks/:id/edit" element={<TaskEditRedirect />} />
  </Route>
);
