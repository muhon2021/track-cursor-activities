/**
 * My Accountability Page
 *
 * Shows the current user's position, responsibilities, and GWC assessment.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, CheckCircle2, XCircle } from "lucide-react";
import { useMyAccountability } from "../hooks/useAccountability";

export default function MyAccountabilityPage() {
  const { data: myRole, isLoading } = useMyAccountability();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!myRole) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Accountability</h1>
          <p className="text-muted-foreground">Your role and responsibilities</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No role assigned</p>
          <p className="text-sm">
            You don't have a position in the current accountability chart.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Accountability</h1>
        <p className="text-muted-foreground">Your role and responsibilities</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role Info */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{myRole.role_title}</CardTitle>
                  {myRole.department && (
                    <Badge variant="outline" className="mt-1">
                      {myRole.department}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {myRole.responsibilities.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium mb-2">Key Responsibilities</p>
                  <ul className="space-y-1.5">
                    {myRole.responsibilities.map((resp, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No responsibilities defined yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Direct Reports */}
          {myRole.direct_reports && myRole.direct_reports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Direct Reports ({myRole.direct_reports.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {myRole.direct_reports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center gap-3 p-2 rounded-lg border"
                    >
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{report.role_title}</p>
                        {report.user && (
                          <p className="text-xs text-muted-foreground">
                            {report.user.full_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* GWC Assessment */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">GWC Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              {myRole.gwc ? (
                <div className="space-y-3">
                  <GWCRow label="Gets It" value={myRole.gwc.gets_it} />
                  <GWCRow label="Wants It" value={myRole.gwc.wants_it} />
                  <GWCRow label="Has Capacity" value={myRole.gwc.has_capacity} />
                  {myRole.gwc.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">{myRole.gwc.notes}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground pt-1">
                    Last assessed:{" "}
                    {new Date(myRole.gwc.assessment_date).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No GWC assessment on file.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GWCRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      {value ? (
        <CheckCircle2 className="h-5 w-5 text-green-500" />
      ) : (
        <XCircle className="h-5 w-5 text-red-400" />
      )}
    </div>
  );
}
