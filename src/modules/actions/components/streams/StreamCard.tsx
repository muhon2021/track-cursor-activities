import { Link, useLocation } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Users } from "lucide-react";
import type { TaskStream } from "../../types/tasks";

interface StreamCardProps {
  stream: TaskStream;
  /** When provided, links use this base path (e.g. /admin/tasks/streams when in admin) */
  basePath?: string;
}

export function StreamCard({ stream, basePath }: StreamCardProps) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const to = basePath
    ? `${basePath}/${stream.id}`
    : `/tasks/stream/${stream.slug || stream.id}`;
  return (
    <Link to={to}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: stream.color }}
            />
            <CardTitle className="text-base">{stream.name}</CardTitle>
          </div>
          {stream.description && (
            <CardDescription className="mt-1 line-clamp-2">
              {stream.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckSquare className="h-4 w-4" />
              {stream.task_count ?? 0} tasks
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {stream.member_count ?? 0} members
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
