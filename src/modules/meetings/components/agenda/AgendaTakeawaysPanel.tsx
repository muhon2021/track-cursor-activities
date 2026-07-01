/**
 * Agenda & Takeaways Panel
 *
 * Split-view panel with agenda items on the left and takeaways on the right.
 * Uses a responsive 2-column grid layout.
 */

import { Loader2 } from "lucide-react";
import { useMeetingAgenda } from "../../hooks/useMeetingAgenda";
import { useMeetingTakeaways } from "../../hooks/useMeetingTakeaways";
import AgendaColumn from "./AgendaColumn";
import TakeawaysColumn from "./TakeawaysColumn";

interface AgendaTakeawaysPanelProps {
  meetingId: string;
}

export default function AgendaTakeawaysPanel({
  meetingId,
}: AgendaTakeawaysPanelProps) {
  const { data: agendaItems = [], isLoading: agendaLoading } =
    useMeetingAgenda(meetingId);
  const { data: takeaways = [], isLoading: takeawaysLoading } =
    useMeetingTakeaways(meetingId);

  if (agendaLoading || takeawaysLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <AgendaColumn meetingId={meetingId} items={agendaItems} />
      <TakeawaysColumn meetingId={meetingId} takeaways={takeaways} />
    </div>
  );
}
