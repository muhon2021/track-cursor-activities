/**
 * Employee Accountability Modal
 *
 * Dialog displaying an employee's position within the accountability chart,
 * including role details, responsibilities, reports-to, direct reports,
 * and GWC assessment.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Mail,
  Users,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { AccountabilityResponsibility } from "../../types";

interface EmployeeAccountabilityModalProps {
  responsibility: AccountabilityResponsibility;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeAccountabilityModal({
  responsibility,
  open,
  onOpenChange,
}: EmployeeAccountabilityModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {responsibility.role_title}
            {responsibility.department && (
              <Badge variant="outline" className="text-xs font-normal">
                {responsibility.department}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Assigned User */}
          {responsibility.user ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Assigned To
              </p>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{responsibility.user.full_name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {responsibility.user.email}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Assigned To
              </p>
              <p className="text-sm text-muted-foreground italic">Unassigned</p>
            </div>
          )}

          <Separator />

          {/* Responsibilities list */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Responsibilities
            </p>
            {responsibility.responsibilities.length > 0 ? (
              <ul className="space-y-1 list-disc list-inside">
                {responsibility.responsibilities.map((item, i) => (
                  <li key={i} className="text-sm">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No responsibilities listed.
              </p>
            )}
          </div>

          {/* Reports To */}
          {responsibility.reports_to && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Reports To
                </p>
                <div className="flex items-center gap-1.5 text-sm">
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{responsibility.reports_to}</span>
                </div>
              </div>
            </>
          )}

          {/* Direct Reports */}
          {responsibility.direct_reports && responsibility.direct_reports.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Direct Reports
                </p>
                <ul className="space-y-1.5">
                  {responsibility.direct_reports.map((report) => (
                    <li key={report.id} className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm">{report.role_title}</span>
                      {report.user && (
                        <span className="text-xs text-muted-foreground">
                          ({report.user.full_name})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* GWC Assessment */}
          {responsibility.gwc && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  GWC Assessment
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <GWCIndicator
                    label="Gets It"
                    value={responsibility.gwc.gets_it}
                  />
                  <GWCIndicator
                    label="Wants It"
                    value={responsibility.gwc.wants_it}
                  />
                  <GWCIndicator
                    label="Capacity"
                    value={responsibility.gwc.has_capacity}
                  />
                </div>
                {responsibility.gwc.notes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {responsibility.gwc.notes}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GWCIndicator({ label, value }: { label: string; value: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm ${
        value
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {value ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}
