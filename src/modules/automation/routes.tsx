import { lazy, Suspense } from "react";
import { Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ModuleRoute } from "@/components/routing/ModuleRoute";
import { PermissionRoute } from "@/components/auth/PermissionRoute";
import WorkflowListPage from "./pages/WorkflowListPage";
import TemplatesPage from "./pages/TemplatesPage";
import LogsPage from "./pages/LogsPage";
import WebhooksPage from "./pages/WebhooksPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ApprovalsPage from "./pages/ApprovalsPage";

const WorkflowBuilderPage = lazy(() => import("./pages/WorkflowBuilderPage"));

function PageLoader() {
  return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export const automationRoutes = (
  <>
    <Route element={<ModuleRoute module="automation" requiresFeatureFlag="enableAutomations" />}>
      <Route element={<PermissionRoute permission="automation.view" />}>
        <Route path="/automation/workflows" element={<WorkflowListPage />} />
        <Route path="/automation/templates" element={<TemplatesPage />} />
        <Route path="/automation/logs" element={<LogsPage />} />
        <Route path="/automation/analytics" element={<AnalyticsPage />} />
        <Route path="/automation/approvals" element={<ApprovalsPage />} />
        <Route
          path="/automation/builder/:id?"
          element={
            <Suspense fallback={<PageLoader />}>
              <WorkflowBuilderPage />
            </Suspense>
          }
        />
      </Route>
      <Route element={<PermissionRoute permission="automation.webhooks.manage" />}>
        <Route path="/automation/webhooks" element={<WebhooksPage />} />
      </Route>
    </Route>
  </>
);

export { WorkflowListPage, TemplatesPage, LogsPage };
