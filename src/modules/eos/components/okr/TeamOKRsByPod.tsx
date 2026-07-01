/**
 * Team OKRs By Pod
 *
 * Groups OKRs by pod with collapsible sections. Each section shows team name
 * with count; expanding shows full OKR cards (same layout as My/Company OKRs).
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { OKRCard } from "./OKRCard";
import type { OKR, EOSPod } from "../../types";

interface PodSection {
  pod: EOSPod | null;
  label: string;
  color: string;
  okrs: OKR[];
}

interface TeamOKRsByPodProps {
  okrs: OKR[];
  pods: EOSPod[];
  onSelectOKR?: (okr: OKR) => void;
  onEdit?: (okr: OKR) => void;
  onDuplicate?: (okr: OKR) => void;
  onClose?: (okr: OKR) => void;
  onDelete?: (okr: OKR) => void;
}

export function TeamOKRsByPod({
  okrs,
  pods,
  onSelectOKR,
  onEdit,
  onDuplicate,
  onClose,
  onDelete,
}: TeamOKRsByPodProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(pods.map((p) => p.id).concat(["unassigned"]))
  );

  const sections = useMemo(() => {
    const podMap = new Map<string, EOSPod>();
    for (const pod of pods) {
      podMap.set(pod.id, pod);
    }

    const grouped = new Map<string, OKR[]>();
    const unassigned: OKR[] = [];

    for (const okr of okrs) {
      if (okr.pod_id && podMap.has(okr.pod_id)) {
        const existing = grouped.get(okr.pod_id);
        if (existing) {
          existing.push(okr);
        } else {
          grouped.set(okr.pod_id, [okr]);
        }
      } else {
        unassigned.push(okr);
      }
    }

    const result: PodSection[] = pods
      .filter((pod) => pod.is_active)
      .map((pod) => ({
        pod,
        label: pod.name,
        color: pod.color,
        okrs: grouped.get(pod.id) || [],
      }));

    if (unassigned.length > 0) {
      result.push({
        pod: null,
        label: "Unassigned",
        color: "#94a3b8",
        okrs: unassigned,
      });
    }

    return result;
  }, [okrs, pods]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Users className="h-8 w-8 mb-2" />
        <p>No team OKRs to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const sectionId = section.pod?.id || "unassigned";
        const isOpen = expandedSections.has(sectionId);

        return (
          <Collapsible
            key={sectionId}
            open={isOpen}
            onOpenChange={() => toggleSection(sectionId)}
          >
            <div className="rounded-lg border">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 px-4 py-3 h-auto hover:bg-muted/50"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-sm">{section.label}</span>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5 ml-auto">
                    {section.okrs.length}
                  </span>
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                {section.okrs.length === 0 ? (
                  <div className="px-4 pb-3 text-sm text-muted-foreground">
                    No OKRs assigned to this team
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    {section.okrs.map((okr) => (
                      <OKRCard
                        key={okr.id}
                        okr={okr}
                        onSelect={() => onSelectOKR?.(okr)}
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        onClose={() => onClose?.(okr)}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
