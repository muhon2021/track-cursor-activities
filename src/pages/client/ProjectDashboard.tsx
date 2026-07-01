/**
 * Legacy-style Client Project Dashboard
 *
 * Placeholder for `/client/project/:token`, mirroring the older route
 * mentioned in the full Projects blueprint from sj-control-main.
 *
 * In this framework, the primary client view is `/projects/:slug/client-portal/:token`
 * backed by `ClientPortalDashboard`. This page exists mainly for backwards
 * compatibility and as a hook if you want a simplified client view.
 */

import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProjectDashboard() {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <CardTitle className="text-lg">Client Project Dashboard (Legacy)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            This route <code>/client/project/:token</code> is a structural placeholder
            from the full Projects blueprint. The recommended client view in this
            framework is:
          </p>
          <p>
            <code>/projects/:slug/client-portal/:token</code>
          </p>
          {token && (
            <p>
              Current token: <span className="font-mono break-all">{token}</span>
            </p>
          )}
          <p>
            You can repurpose this page for a simplified public project view or
            redirect it to the enhanced client portal once your migration plan is ready.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

