/**
 * Task Hooks (Actions Module)
 *
 * CRUD operations and filtered queries for the tasks table,
 * with support for streams, subtasks, views (today, week, overdue, delegated).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { emitAutomationEvent } from "@/lib/automation-emit";
import type { Task, TaskFormData, TaskFilters, TaskStats, TaskView } from "../types/tasks";

/**
 * Fetch tasks with filters and view support.
 */
export function useTasksV2(filters?: TaskFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.tasks.listV2(filters ?? {}),
    queryFn: async (): Promise<Task[]> => {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          clients(name),
          meetings(title),
          task_streams(name, color, slug),
          task_categories(name, color)
        `)
        .is("parent_id", null) // Only top-level tasks
        .order("created_at", { ascending: false });

      if (filters?.view === "jira") {
        query = query.eq("metadata->>source", "jira");
      } else if (
        filters?.view === "clickup" ||
        filters?.view === "activecollab" ||
        filters?.view === "workamajig"
      ) {
        query = query.eq("metadata->>source", filters.view);
      } else if (filters?.view && filters.view !== "all") {
        query = applyViewFilter(query, filters.view, user?.id, filters);
      }

      // Explicit filters
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.priority && filters.priority !== "all") {
        query = query.eq("priority", filters.priority);
      }
      if (filters?.assigned_to) {
        query = query.eq("assigned_to", filters.assigned_to);
      }
      if (filters?.stream_id) {
        query = query.or(`stream_id.eq.${filters.stream_id},category_id.eq.${filters.stream_id}`);
      }
      if (filters?.category_id) {
        query = query.eq("category_id", filters.category_id);
      }
      if (filters?.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }
      if (filters?.dueDateFrom) {
        query = query.gte("due_date", filters.dueDateFrom);
      }
      if (filters?.dueDateTo) {
        query = query.lte("due_date", filters.dueDateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      const tasks = (data || []).map(mapTaskRow);
      const assigneeIds = tasks.map((t) => t.assigned_to).filter(Boolean);
      const profileMap = await fetchAssigneeProfiles(assigneeIds);
      tasks.forEach((t) => {
        if (t.assigned_to) t.assigned_user = profileMap.get(t.assigned_to!) ?? null;
      });
      return tasks;
    },
    enabled: !!user,
  });
}

/**
 * Fetch a single task by ID with subtasks and comment count.
 */
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id ?? ""),
    queryFn: async (): Promise<Task | null> => {
      if (!id) return null;

      // Fetch task
      const { data: task, error } = await supabase
        .from("tasks")
        .select(`
          *,
          clients(name),
          meetings(title),
          task_streams(name, color, slug),
          task_categories(name, color)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      if (!task) return null;

      // Fetch subtasks
      const { data: subtasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("parent_id", id)
        .order("position", { ascending: true });

      // Fetch comment count
      const { count } = await supabase
        .from("task_comments")
        .select("id", { count: "exact", head: true })
        .eq("task_id", id);

      const mapped = mapTaskRow(task);
      mapped.subtasks = (subtasks || []).map(mapTaskRow);
      mapped.comment_count = count || 0;

      const assigneeIds = [mapped.assigned_to, ...mapped.subtasks.map((s) => s.assigned_to)].filter(Boolean);
      const profileMap = await fetchAssigneeProfiles(assigneeIds);
      if (mapped.assigned_to) mapped.assigned_user = profileMap.get(mapped.assigned_to) ?? null;
      mapped.subtasks.forEach((s) => {
        if (s.assigned_to) s.assigned_user = profileMap.get(s.assigned_to!) ?? null;
      });

      return mapped;
    },
    enabled: !!id,
  });
}

/**
 * Task statistics for the current view.
 */
export function useTaskStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.tasks.stats,
    queryFn: async (): Promise<TaskStats> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("status, due_date, assigned_to, created_by, metadata")
        .is("parent_id", null);

      if (error) throw error;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const todayEnd = todayStart + 24 * 60 * 60 * 1000;
      const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;
      const tasks = data || [];
      const uid = user?.id;

      const notDone = (t: { status: string }) =>
        t.status !== "completed" && t.status !== "cancelled";

      const sourceOf = (t: { metadata: unknown }) =>
        (t.metadata as { source?: string } | null)?.source;

      const countBySource = (source: string) =>
        tasks.filter((t) => sourceOf(t) === source).length;

      return {
        total: tasks.length,
        todo: tasks.filter((t) => t.status === "todo").length,
        in_progress: tasks.filter((t) => t.status === "in_progress").length,
        completed: tasks.filter((t) => t.status === "completed").length,
        overdue: tasks.filter(
          (t) =>
            t.due_date &&
            new Date(t.due_date).getTime() < todayStart &&
            notDone(t)
        ).length,
        todayCount:
          uid === undefined
            ? 0
            : tasks.filter((t) => {
                if (t.assigned_to !== uid || !notDone(t) || !t.due_date) return false;
                const d = new Date(t.due_date).getTime();
                return d >= todayStart && d < todayEnd;
              }).length,
        thisWeekCount:
          uid === undefined
            ? 0
            : tasks.filter((t) => {
                if (t.assigned_to !== uid || !notDone(t) || !t.due_date) return false;
                const d = new Date(t.due_date).getTime();
                return d >= todayStart && d < weekEnd;
              }).length,
        delegatedCount:
          uid === undefined
            ? 0
            : tasks.filter(
                (t) =>
                  t.created_by === uid &&
                  t.assigned_to !== uid &&
                  t.assigned_to != null &&
                  notDone(t)
              ).length,
        allMineCount:
          uid === undefined
            ? 0
            : tasks.filter((t) => t.assigned_to === uid || t.created_by === uid).length,
        jiraCount: countBySource("jira"),
        clickupCount: countBySource("clickup"),
        activecollabCount: countBySource("activecollab"),
        workamajigCount: countBySource("workamajig"),
      };
    },
    enabled: !!user,
  });
}

/**
 * Fetch a single task by slug (for URL /tasks/:slug). If idOrSlug looks like UUID, fetches by id.
 */
export function useTaskBySlug(idOrSlug: string | undefined) {
  const isUuid = idOrSlug?.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  );
  return useQuery({
    queryKey: queryKeys.tasks.detailBySlug(idOrSlug ?? ""),
    queryFn: async (): Promise<Task | null> => {
      if (!idOrSlug) return null;
      const { data: task, error } = await supabase
        .from("tasks")
        .select(`
          *,
          clients(name),
          meetings(title),
          task_streams(name, color, slug),
          task_categories(name, color)
        `)
        .eq(isUuid ? "id" : "slug", idOrSlug)
        .single();
      if (error) throw error;
      if (!task) return null;
      const { data: subtasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("parent_id", task.id)
        .order("position", { ascending: true });
      const { count } = await supabase
        .from("task_comments")
        .select("id", { count: "exact", head: true })
        .eq("task_id", task.id);
      const mapped = mapTaskRow(task);
      mapped.subtasks = (subtasks || []).map(mapTaskRow);
      mapped.comment_count = count || 0;

      const assigneeIds = [mapped.assigned_to, ...mapped.subtasks.map((s) => s.assigned_to)].filter(Boolean);
      const profileMap = await fetchAssigneeProfiles(assigneeIds);
      if (mapped.assigned_to) mapped.assigned_user = profileMap.get(mapped.assigned_to) ?? null;
      mapped.subtasks.forEach((s) => {
        if (s.assigned_to) s.assigned_user = profileMap.get(s.assigned_to!) ?? null;
      });

      return mapped;
    },
    enabled: !!idOrSlug,
  });
}

/**
 * Tasks where assignee = current user, due today, not done/archived.
 */
export function useTodayTasks(userId: string | undefined, search?: string) {
  return useTasksV2({ view: "today", search: search || undefined });
}

/**
 * Tasks where assignee = current user, due this week, not done/archived.
 */
export function useThisWeekTasks(userId: string | undefined, search?: string) {
  return useTasksV2({ view: "this_week", search: search || undefined });
}

/**
 * Tasks where assignee = current user, due < today, not done/archived.
 */
export function useOverdueTasks(userId: string | undefined, search?: string) {
  return useTasksV2({ view: "overdue", search: search || undefined });
}

/**
 * Tasks where created_by = current user, assignee != current user, not done/archived.
 */
export function useDelegatedTasks(userId: string | undefined, search?: string) {
  return useTasksV2({ view: "delegated", search: search || undefined });
}

/**
 * All tasks for current user: assignee or created_by = userId, any status.
 */
export function useMyUnifiedTasksV2(userId: string | undefined, search?: string) {
  return useTasksV2({ view: "allMine", search: search || undefined });
}

/**
 * Create a new task.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: TaskFormData) => {
      const slug = generateSlug(data.title);
      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          title: data.title,
          description: data.description || null,
          status: data.status,
          priority: data.priority,
          due_date: data.due_date || null,
          assigned_to: data.assigned_to || null,
          stream_id: data.stream_id || null,
          parent_id: data.parent_id || null,
          category_id: data.category_id || null,
          client_id: data.client_id || null,
          meeting_id: data.meeting_id || null,
          created_by: user!.id,
          slug,
        })
        .select()
        .single();

      if (error) throw error;
      return task;
    },
    onSuccess: (task) => {
      invalidateKeys.tasks(queryClient);
      emitAutomationEvent("task.created", {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigned_to: task.assigned_to,
      });
      toast.success("Task created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create task", { description: error.message });
    },
  });
}

/**
 * Update an existing task.
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskFormData> & { completed_at?: string | null } }) => {
      // If status is changing to completed, set completed_at
      const updateData: Record<string, unknown> = { ...data };
      if (data.status === "completed" && !data.completed_at) {
        updateData.completed_at = new Date().toISOString();
      } else if (data.status && data.status !== "completed") {
        updateData.completed_at = null;
      }

      const { data: task, error } = await supabase
        .from("tasks")
        .update(updateData as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return task;
    },
    onSuccess: (task) => {
      invalidateKeys.tasks(queryClient);
      emitAutomationEvent("task.updated", {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigned_to: task.assigned_to,
      });
      if (task.status === "completed") {
        emitAutomationEvent("task.completed", {
          id: task.id,
          title: task.title,
          assigned_to: task.assigned_to,
        });
      }
      toast.success("Task updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update task", { description: error.message });
    },
  });
}

/**
 * Delete a task.
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.tasks(queryClient);
      toast.success("Task deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete task", { description: error.message });
    },
  });
}

// ========================
// Helpers
// ========================

function applyViewFilter(query: any, view: TaskView, userId?: string, filters?: TaskFilters) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();
  const notDone = () =>
    query.not("status", "in", '("completed","cancelled")');

  switch (view) {
    case "today":
      return userId
        ? notDone()
            .eq("assigned_to", userId)
            .lte("due_date", todayEnd)
            .gte("due_date", todayStart)
        : query;
    case "this_week":
      if (userId && filters?.dueDateFrom && filters?.dueDateTo) {
        return notDone()
          .eq("assigned_to", userId)
          .gte("due_date", filters.dueDateFrom)
          .lte("due_date", filters.dueDateTo);
      }
      return userId
        ? notDone()
            .eq("assigned_to", userId)
            .lte("due_date", weekEnd)
            .gte("due_date", todayStart)
        : query;
    case "overdue":
      return userId
        ? notDone().eq("assigned_to", userId).lt("due_date", todayStart)
        : query;
    case "delegated":
      return userId
        ? query
            .eq("created_by", userId)
            .not("assigned_to", "eq", userId)
            .not("assigned_to", "is", null)
            .not("status", "in", '("completed","cancelled")')
        : query;
    case "allMine":
      return userId
        ? query.or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
        : query;
    case "my_tasks":
      return userId ? query.eq("assigned_to", userId) : query;
    default:
      return query;
  }
}

function mapTaskRow(row: any): Task {
  return {
    ...row,
    stream: row.task_streams || null,
    category: row.task_categories || null,
    task_streams: undefined,
    task_categories: undefined,
  };
}

/** Fetch multiple assignee profiles by user ids. Returns Map<userId, profile>. */
async function fetchAssigneeProfiles(
  userIds: (string | null | undefined)[]
): Promise<Map<string, { full_name: string; email: string }>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);
  const map = new Map<string, { full_name: string; email: string }>();
  (data || []).forEach((p) => map.set(p.id, { full_name: p.full_name ?? "", email: p.email ?? "" }));
  return map;
}

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}
