/**
 * Meeting Status Badge
 *
 * Color-coded badge component for displaying meeting status.
 */

import { Badge } from "@/components/ui/badge";

interface MeetingStatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function capitalizeFirst(str: string): string {
  if (!str) return "";
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function MeetingStatusBadge({
  status,
}: MeetingStatusBadgeProps) {
  const colorClass = statusConfig[status] || "bg-gray-100 text-gray-800";

  return (
    <Badge className={colorClass}>
      {capitalizeFirst(status)}
    </Badge>
  );
}
