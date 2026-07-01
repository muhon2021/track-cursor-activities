/**
 * Accountability Page
 *
 * Displays the organizational accountability chart.
 */

import { Loader2 } from "lucide-react";
import { useAccountabilityChart } from "../hooks/useAccountability";
import { OrgTree } from "../components/accountability/OrgTree";

export default function AccountabilityPage() {
  const { data: chart, isLoading } = useAccountabilityChart();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accountability Chart</h1>
        <p className="text-muted-foreground">
          Organizational structure and role responsibilities
        </p>
        {chart && (
          <p className="text-xs text-muted-foreground mt-1">
            Version {chart.version}
            {chart.published_at && ` · Published ${new Date(chart.published_at).toLocaleDateString()}`}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : chart ? (
        <OrgTree responsibilities={chart.responsibilities || []} />
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No accountability chart</p>
          <p className="text-sm">
            An accountability chart can be configured in the admin panel.
          </p>
        </div>
      )}
    </div>
  );
}
