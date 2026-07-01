import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, getInitials } from "@/lib/utils";
import type { SharedUser } from "../api/file";
import { useKnowledgeDirectoryUsers } from "../hooks/useKnowledgeDirectoryUsers";

interface ManageAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceName: string;
  ownerId: string;
  sharedWith: SharedUser[];
  onSave: (sharedWith: SharedUser[]) => Promise<void>;
  isSaving?: boolean;
}

function matchesUserSearch(user: { fullName: string; email: string }, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) {
    return true;
  }

  return user.fullName.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
}

export function ManageAccessModal({
  open,
  onOpenChange,
  resourceName,
  ownerId,
  sharedWith,
  onSave,
  isSaving = false,
}: ManageAccessModalProps): JSX.Element {
  const [search, setSearch] = useState("");
  const [peopleWithAccess, setPeopleWithAccess] = useState<SharedUser[]>(sharedWith);
  const { data: directoryUsers = [], isLoading } = useKnowledgeDirectoryUsers(ownerId);

  // Sync internal state with the currently selected resource whenever the modal
  // opens or the target changes. The Dialog is opened by external state, so its
  // own onOpenChange(true) never fires and cannot be relied on for syncing.
  useEffect(() => {
    if (open) {
      setPeopleWithAccess(sharedWith);
      setSearch("");
    }
  }, [open, sharedWith]);

  const visibleUsers = useMemo(
    () => directoryUsers.filter((user) => matchesUserSearch(user, search)),
    [directoryUsers, search],
  );

  const accessIds = useMemo(
    () => new Set(peopleWithAccess.map((person) => person.id)),
    [peopleWithAccess],
  );

  const handleOpenChange = (nextOpen: boolean): void => {
    onOpenChange(nextOpen);
  };

  const toggleUserAccess = (user: { id: string; email: string; fullName: string; avatarUrl: string | null }): void => {
    if (accessIds.has(user.id)) {
      setPeopleWithAccess((current) => current.filter((person) => person.id !== user.id));
      return;
    }

    setPeopleWithAccess((current) => [
      ...current,
      {
        id: user.id,
        name: user.fullName,
        email: user.email,
        avatar: user.avatarUrl ?? undefined,
        permissions: "read",
        addedAt: new Date().toISOString(),
      },
    ]);
  };

  const removeAccess = (userId: string): void => {
    setPeopleWithAccess((current) => current.filter((person) => person.id !== userId));
  };

  const handleSave = async (): Promise<void> => {
    await onSave(peopleWithAccess);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Manage Access - {resourceName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          <div className="space-y-3">
            <p className="text-sm font-medium">All Users</p>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users by name or email..."
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-56 rounded-lg border">
              <div className="divide-y">
                {isLoading ? (
                  <p className="p-4 text-sm text-muted-foreground">Loading users...</p>
                ) : visibleUsers.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No users found.</p>
                ) : (
                  visibleUsers.map((user) => {
                    const selected = accessIds.has(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleUserAccess(user)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                          selected && "bg-primary/5",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border-2",
                            selected ? "border-primary bg-primary" : "border-primary/40",
                          )}
                        >
                          {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                        </span>
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName} />
                          <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{user.fullName}</span>
                          <span className="block truncate text-sm text-muted-foreground">{user.email}</span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">People with access ({peopleWithAccess.length})</p>
            {peopleWithAccess.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No one has access yet. Select users above to share this item.
              </div>
            ) : (
              <div className="space-y-2">
                {peopleWithAccess.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={person.avatar} alt={person.name} />
                        <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{person.name}</span>
                        <span className="block truncate text-sm text-muted-foreground">{person.email}</span>
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAccess(person.id)}
                      aria-label={`Remove access for ${person.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
