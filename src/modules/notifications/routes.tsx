import { Route } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";
import { PermissionRoute } from "@/components/auth/PermissionRoute";
import NotificationCenterPage from "./pages/NotificationCenterPage";
import NotificationPreferencesPage from "./pages/NotificationPreferencesPage";

export const notificationRoutes = (
  <>
    <Route element={<ModuleRoute requiresFeatureFlag="enableNotifications" />}>
      <Route element={<PermissionRoute permission="notifications.view" />}>
        <Route path="/notifications" element={<NotificationCenterPage />} />
        <Route path="/settings/notifications" element={<NotificationPreferencesPage />} />
      </Route>
    </Route>
  </>
);

export const operationsNotificationRoutes = (
  <>
    <Route element={<ModuleRoute requiresFeatureFlag="enableNotifications" />}>
      <Route element={<PermissionRoute permission="notifications.view" />}>
        <Route
          path="/operations/notifications"
          element={<NotificationCenterPage settingsPath="/settings/notifications" />}
        />
        <Route path="/operations/settings/notifications" element={<NotificationPreferencesPage />} />
      </Route>
    </Route>
  </>
);
