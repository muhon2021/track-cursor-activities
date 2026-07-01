import { Route } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { KnowledgeSpaceDashboard } from "@/pages/spaces";
import Knowledge from "@/modules/knowledge/pages/Knowledge";
import KnowledgeUpload from "@/modules/knowledge/pages/KnowledgeUpload";
import PersonalKnowledge from "@/modules/knowledge/pages/PersonalKnowledge";
import SemanticSearch from "@/modules/knowledge/pages/SemanticSearch";
import KnowledgeByCategory from "@/modules/knowledge/pages/KnowledgeByCategory";
import KnowledgeForm from "@/modules/knowledge/pages/KnowledgeForm";
import KnowledgeDetail from "@/modules/knowledge/pages/KnowledgeDetail";
import KnowledgePlayground from "@/pages/admin/KnowledgePlayground";
import KnowledgePermissions from "@/pages/admin/KnowledgePermissions";
import KnowledgeCategories from "@/pages/admin/KnowledgeCategories";
import KnowledgeFiles from "@/pages/admin/KnowledgeFiles";
import MemoryAdministration from "@/pages/admin/MemoryAdministration";
import EmbeddingsExplorer from "@/pages/admin/EmbeddingsExplorer";
import AIModelManagement from "@/pages/admin/AIModelManagement";
import AIAnalytics from "@/pages/admin/ai/AIAnalytics";
import Memory from "@/pages/admin/ai-hub/Memory";
import KnowledgeSearch from "@/pages/admin/ai-hub/KnowledgeSearch";
import AIAgents from "@/pages/AIAgents";
import AgentsBrowse from "@/pages/AgentsBrowse";
import AgentDetail from "@/pages/AgentDetail";
import PromptTemplateManagement from "@/pages/admin/ai/PromptTemplateManagement";
import AgentCategories from "@/pages/admin/ai/AgentCategories";

export const knowledgeSpaceRoutes = (
  <>
    <Route element={<AdminRoute />}>
      <Route path="/knowledge/dashboard" element={<KnowledgeSpaceDashboard />} />
      <Route path="/knowledge/playground" element={<KnowledgePlayground />} />
      <Route path="/knowledge/permissions" element={<KnowledgePermissions />} />
      <Route path="/knowledge/categories" element={<KnowledgeCategories />} />
      <Route path="/knowledge/files" element={<KnowledgeFiles />} />
      <Route path="/knowledge/memory-admin" element={<MemoryAdministration />} />
      <Route path="/knowledge/embeddings" element={<EmbeddingsExplorer />} />
      <Route path="/knowledge/ai-models" element={<AIModelManagement />} />
      <Route path="/knowledge/agent-analytics" element={<AIAnalytics />} />
      <Route path="/knowledge/ai-hub" element={<Memory />} />
      <Route path="/knowledge/ai-hub/search" element={<KnowledgeSearch />} />
      <Route path="/knowledge/prompt-templates" element={<PromptTemplateManagement />} />
      <Route path="/knowledge/agent-categories" element={<AgentCategories />} />
    </Route>
    <Route element={<ModuleRoute module="knowledge" requiresFeatureFlag="enableKnowledgeBase" />}>
      <Route path="/knowledge/base" element={<Knowledge />} />
      <Route path="/knowledge/base/upload" element={<KnowledgeUpload />} />
      <Route path="/knowledge/search" element={<SemanticSearch />} />
      <Route path="/knowledge/base/category/:slug" element={<KnowledgeByCategory />} />
      <Route path="/knowledge/base/new" element={<KnowledgeForm />} />
      <Route path="/knowledge/base/:id" element={<KnowledgeDetail />} />
      <Route path="/knowledge/base/:id/edit" element={<KnowledgeForm />} />
    </Route>
    <Route element={<ModuleRoute requiresFeatureFlag="enablePersonalKnowledge" />}>
      <Route path="/knowledge/personal" element={<PersonalKnowledge />} />
    </Route>
    <Route element={<ModuleRoute requiresFeatureFlag="enableAIAgents" />}>
      <Route path="/knowledge/agents" element={<AgentsBrowse />} />
      <Route path="/knowledge/agents/:slug" element={<AgentDetail />} />
      <Route path="/knowledge/chat" element={<AIAgents />} />
    </Route>
  </>
);
