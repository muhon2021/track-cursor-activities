/**
 * Projects Module Routes – full structure per replication guide
 * List: Projects (src/pages/Projects.tsx), Detail: ProjectDetail, Knowledge, Performance, Issues AI
 */
import { Route } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";

import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/projects/ProjectDetail";
import ProjectKnowledge from "@/pages/projects/ProjectKnowledge";
import Performance from "@/pages/projects/Performance";
import ProjectFormPage from "./pages/ProjectFormPage";
import ProjectIssuesAIAnalyzePage from "@/pages/ProjectIssuesAIAnalyzePage";

export const projectsRoutes = (
  <Route element={<ModuleRoute module="projects" />}>
    <Route path="/projects" element={<Projects />} />
    <Route path="/projects/new" element={<ProjectFormPage />} />
    <Route path="/projects/:slug/edit" element={<ProjectFormPage />} />
    <Route path="/projects/:slug/knowledge" element={<ProjectKnowledge />} />
    <Route path="/projects/:slug/issues/ai/analyze" element={<ProjectIssuesAIAnalyzePage />} />
    <Route path="/projects/:slug/performance" element={<Performance />} />
    <Route path="/projects/:slug/:tab" element={<ProjectDetail />} />
    <Route path="/projects/:slug" element={<ProjectDetail />} />
  </Route>
);
