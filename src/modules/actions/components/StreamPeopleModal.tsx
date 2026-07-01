/**
 * Modal listing users who have access to a stream (from task_stream_members).
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User } from "lucide-react";

interface StreamPeopleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streamId: string;
}

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
}

export function StreamPeopleModal({
  open,
  onOpenChange,
  streamId,
}: StreamPeopleModalProps) {
  const { data: members, isLoading } = useQuery({
    queryKey: ["tasks", "streamMembers", streamId],
    queryFn: async (): Promise<MemberRow[]> => {
      const { data: rows, error } = await supabase
        .from("task_stream_members")
        .select("id, user_id, role")
        .eq("stream_id", streamId)
        .order("role", { ascending: true });
      if (error) throw error;
      const list = rows || [];
      if (list.length === 0) return [];
      const userIds = [...new Set(list.map((r: { user_id: string }) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const profileMap = new Map(
        (profiles || []).map((p: { id: string; full_name: string | null; email: string | null }) => [
          p.id,
          { full_name: p.full_name, email: p.email },
        ])
      );
      return list.map((row: { id: string; user_id: string; role: string }) => {
        const p = profileMap.get(row.user_id);
        return {
          id: row.id,
          user_id: row.user_id,
          role: row.role,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
        };
      });
    },
    enabled: open && !!streamId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stream members</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="space-y-2 max-h-[60vh] overflow-auto">
            {(members || []).map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-lg border p-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {m.full_name || m.email || "Unknown"}
                  </p>
                  {m.email && m.full_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {m.email}
                    </p>
                  )}
                </div>
                <span className="text-xs capitalize text-muted-foreground">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!isLoading && members?.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">
            No members in this stream yet.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
