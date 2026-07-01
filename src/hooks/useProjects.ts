/**
 * Projects hooks – canonical path per PROJECTS-EXACT-FILE-LIST.
 * Re-exports from module.
 */
export {
  useProjects,
  useProject,
  useProjectBySlug,
  useProjectStatuses,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useManagers,
  useTeams,
  useProjectCategories,
} from "@/modules/projects/hooks/useProjects";
export type { Project, ProjectStatus, ProjectFormData, ProjectFilters } from "@/modules/projects/types";
