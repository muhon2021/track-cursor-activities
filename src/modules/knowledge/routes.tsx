/**
 * Knowledge Base Module Routes
 *
 * Knowledge management, uploads, categories, and personal knowledge.
 * Gated by the "knowledge" module / "enableKnowledgeBase" feature flag.
 */
import { Route } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";

import Knowledge from "./pages/Knowledge";
import KnowledgeForm from "./pages/KnowledgeForm";
import KnowledgeDetail from "./pages/KnowledgeDetail";
import KnowledgeUpload from "./pages/KnowledgeUpload";
import KnowledgeByCategory from "./pages/KnowledgeByCategory";
import PersonalKnowledge from "./pages/PersonalKnowledge";
import SemanticSearch from "./pages/SemanticSearch";

export const knowledgeRoutes = (
  <Route element={<ModuleRoute module="knowledge" requiresFeatureFlag="enableKnowledgeBase" />}>
    <Route path="/knowledge" element={<Knowledge />} />
    <Route path="/knowledge/upload" element={<KnowledgeUpload />} />
    <Route path="/knowledge/personal" element={<PersonalKnowledge />} />
    <Route path="/knowledge/search" element={<SemanticSearch />} />
    <Route path="/knowledge/category/:slug" element={<KnowledgeByCategory />} />
    <Route path="/knowledge/new" element={<KnowledgeForm />} />
    <Route path="/knowledge/:id" element={<KnowledgeDetail />} />
    <Route path="/knowledge/:id/edit" element={<KnowledgeForm />} />
  </Route>
);
