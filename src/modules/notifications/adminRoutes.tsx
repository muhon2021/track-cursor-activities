import { Route, Navigate } from "react-router-dom";
import { PermissionRoute } from "@/components/auth/PermissionRoute";
import AdminNotificationsDashboard from "./pages/admin/AdminNotificationsDashboard";
import NotificationRulesPage from "./pages/admin/NotificationRulesPage";
import NotificationLogsPage from "./pages/admin/NotificationLogsPage";
import NotificationTemplatesPage from "./pages/admin/NotificationTemplatesPage";

export const adminNotificationRoutes = (
  <>
    <Route element={<PermissionRoute permission="notifications.admin" fallbackPermission="settings.admin" />}>
      <Route path="/admin/notifications" element={<AdminNotificationsDashboard />} />
      <Route path="/admin/notification-rules" element={<NotificationRulesPage />} />
      <Route path="/admin/notification-templates" element={<NotificationTemplatesPage />} />
    </Route>
    <Route element={<PermissionRoute permission="notifications.export" fallbackPermission="notifications.admin" />}>
      <Route path="/admin/notification-logs" element={<NotificationLogsPage />} />
    </Route>
    <Route path="/admin/settings/notifications" element={<Navigate to="/admin/notifications?tab=email" replace />} />
  </>
);
