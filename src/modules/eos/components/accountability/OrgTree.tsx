/**
 * Org Tree Component
 *
 * Renders the accountability chart as a hierarchical tree.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { GWCBadge } from "./GWCBadge";
import type { AccountabilityResponsibility } from "../../types";

interface OrgTreeProps {
  responsibilities: AccountabilityResponsibility[];
  onSelect?: (responsibility: AccountabilityResponsibility) => void;
}

export function OrgTree({ responsibilities, onSelect }: OrgTreeProps) {
  if (responsibilities.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p>No accountability chart configured yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {responsibilities.map((r) => (
        <OrgNode key={r.id} responsibility={r} onSelect={onSelect} level={0} />
      ))}
    </div>
  );
}

function OrgNode({
  responsibility,
  onSelect,
  level,
}: {
  responsibility: AccountabilityResponsibility;
  onSelect?: (r: AccountabilityResponsibility) => void;
  level: number;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = (responsibility.direct_reports?.length || 0) > 0;

  return (
    <div style={{ marginLeft: level > 0 ? `${level * 24}px` : undefined }}>
      <Card
        className="cursor-pointer hover:shadow-sm transition-shadow"
        onClick={() => onSelect?.(responsibility)}
      >
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="p-0.5 rounded hover:bg-muted"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            ) : (
              <div className="w-5" />
            )}

            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{responsibility.role_title}</p>
                {responsibility.department && (
                  <Badge variant="outline" className="text-xs">
                    {responsibility.department}
                  </Badge>
                )}
              </div>
              {responsibility.user && (
                <p className="text-xs text-muted-foreground">{responsibility.user.full_name}</p>
              )}
            </div>

            {responsibility.gwc && <GWCBadge assessment={responsibility.gwc} />}

            {responsibility.responsibilities.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {responsibility.responsibilities.length} responsibilities
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {expanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {responsibility.direct_reports!.map((child) => (
            <OrgNode
              key={child.id}
              responsibility={child}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
