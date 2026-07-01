import { Loader2 } from "lucide-react";
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { SpacePathRedirect } from "@/components/routing/SpacePathRedirect";
import { publicRoutes, coreProtectedRoutes, catchAllRoute } from "@/modules/platform";
import { meetingsRoutes } from "@/modules/meetings";
import { actionsRoutes } from "@/modules/actions";
import { knowledgeRoutes } from "@/modules/knowledge";
import { businessDevRoutes } from "@/modules/business-dev";
import { eosRoutes } from "@/modules/eos";
import { projectsRoutes } from "@/modules/projects";
import { productivityRoutes } from "@/modules/productivity";
import { automationRoutes } from "@/modules/automation";
import { graphifyRoutes } from "@/modules/graphify";
import { adminRoutes } from "@/modules/admin";
import ClientPortalDashboard from "@/pages/client/ClientPortalDashboard";
import ProjectDashboard from "@/pages/client/ProjectDashboard";
import MFAEnroll from "@/pages/MFAEnroll";
import PasswordExpired from "@/pages/PasswordExpired";

/**
 * Full application route tree. Must render <Route> elements as direct children
 * of <Routes> — React Router v6 does not pick up routes returned from a
 * component nested inside another <Route>.
 */
export function AppRoutes() {
  return (
    <Routes>
      {publicRoutes}

      <Route
        path="/projects/:slug/client-portal/:token"
        element={<ClientPortalDashboard />}
      />
      <Route path="/client/project/:token" element={<ProjectDashboard />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/mfa/enroll" element={<MFAEnroll />} />
        <Route path="/auth/password-expired" element={<PasswordExpired />} />

        {/* Four Spaces URLs → legacy routes (feature disabled) */}
        <Route path="/sales/*" element={<SpacePathRedirect />} />
        <Route path="/knowledge/*" element={<SpacePathRedirect />} />
        <Route path="/operations/*" element={<SpacePathRedirect />} />

        <Route element={<DashboardLayout />}>
          {coreProtectedRoutes}
          {businessDevRoutes}
          {meetingsRoutes}
          {actionsRoutes}
          {knowledgeRoutes}
          {eosRoutes}
          {projectsRoutes}
          {productivityRoutes}
          {automationRoutes}
          {graphifyRoutes}
        </Route>

        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>{adminRoutes}</Route>
        </Route>
      </Route>

      {catchAllRoute}
    </Routes>
  );
}
