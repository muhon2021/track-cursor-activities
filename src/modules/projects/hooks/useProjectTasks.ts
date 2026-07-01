/**
 * Project Tasks — real Supabase queries
 *
 * Fetches tasks associated with the same client as the project.
 * Tasks link to projects indirectly via client_id, and can also
 * be identified by the project's external_id for synced sources.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  source: "internal" | "activecollab" | "jira" | "clickup" | "workamajig";
  external_id: string | null;
  created_at: string;
}

function mapTaskStatus(status: string): "todo" | "in_progress" | "done" {
  if (status === "completed" || status === "done") return "done";
  if (status === "in_progress") return "in_progress";
  return "todo";
}

export function useProjectTasks(projectId: string) {
  return useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async (): Promise<ProjectTask[]> => {
      // Get the project so we can link tasks either by client_id (internal)
      // or by external provider/id (for synced tools like ClickUp / Workamajig).
      const { data: project, error: projError } = await supabase
        .from("projects")
        .select("id, client_id, external_id, external_provider")
        .eq("id", projectId)
        .single();

      if (projError) throw projError;
      if (!project) return [];

      const queries: Array<PromiseLike<any>> = [];

      // 1) Tasks linked via client_id (existing behavior)
      if (project.client_id) {
        queries.push(
          supabase
            .from("tasks")
            .select("id, title, status, priority, due_date, assigned_to, metadata, created_at")
            .eq("client_id", project.client_id)
            .order("created_at", { ascending: false })
            .limit(50)
            .then(res => res),
        );
      }

      // 2) Tasks synced from external project tools (ClickUp, Workamajig, Jira, ActiveCollab)
      if (project.external_id && project.external_provider) {
        queries.push(
          supabase
            .from("tasks")
            .select("id, title, status, priority, due_date, assigned_to, metadata, created_at")
            .contains("metadata", {
              project_external_id: project.external_id,
            })
            .order("created_at", { ascending: false })
            .limit(50)
            .then(res => res),
        );
      }

      if (queries.length === 0) return [];

      const results = await Promise.all(queries);
      const allTasks = results
        .flatMap((r) => {
          if (r.error) throw r.error;
          return r.data || [];
        })
        // De-duplicate by id in case the same task matches multiple filters
        .reduce((acc: Record<string, any>, t: any) => {
          acc[t.id] = t;
          return acc;
        }, {});

      const tasksArray = Object.values(allTasks) as any[];

      return tasksArray.map((t) => {
        const meta = (t as any).metadata || {};
        const rawSource = (meta.source as string) || "internal";
        const normalizedSource: ProjectTask["source"] =
          rawSource === "activecollab" ||
          rawSource === "jira" ||
          rawSource === "clickup" ||
          rawSource === "workamajig"
            ? (rawSource as ProjectTask["source"])
            : "internal";
        const externalId = (meta.external_id as string) || null;

        return {
          id: t.id,
          project_id: projectId,
          title: t.title,
          status: mapTaskStatus(t.status),
          priority: t.priority || "medium",
          due_date: t.due_date,
          assigned_to: t.assigned_to,
          source: normalizedSource,
          external_id: externalId,
          created_at: t.created_at,
        };
      });
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });
}
