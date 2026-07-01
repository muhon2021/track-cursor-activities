import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  MoreHorizontal,
  Pin,
  PinOff,
  Pencil,
  Archive,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AgentConversation,
  useUpdateConversation,
  useDeleteConversation,
  useArchiveConversation,
  useTogglePinConversation,
} from "@/hooks/useAgentConversations";

interface AgentConversationItemProps {
  conversation: AgentConversation;
  isSelected: boolean;
  onClick: () => void;
}

export function AgentConversationItem({
  conversation,
  isSelected,
  onClick,
}: AgentConversationItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(conversation.title || "");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const updateConversation = useUpdateConversation();
  const deleteConversation = useDeleteConversation();
  const archiveConversation = useArchiveConversation();
  const togglePin = useTogglePinConversation();

  const handleRename = async () => {
    if (newTitle.trim() && newTitle !== conversation.title) {
      await updateConversation.mutateAsync({
        id: conversation.id,
        data: { title: newTitle.trim() },
      });
    }
    setIsRenaming(false);
  };

  const handleDelete = async () => {
    await deleteConversation.mutateAsync({
      id: conversation.id,
      agentId: conversation.agent_id,
    });
    setShowDeleteDialog(false);
  };

  const handleArchive = async () => {
    await archiveConversation.mutateAsync({
      id: conversation.id,
      agentId: conversation.agent_id,
    });
  };

  const handleTogglePin = async () => {
    await togglePin.mutateAsync({
      id: conversation.id,
      agentId: conversation.agent_id,
      isPinned: conversation.is_pinned,
    });
  };

  const displayTitle =
    conversation.title || "New conversation";

  const lastMessageTime = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
        addSuffix: true,
      })
    : formatDistanceToNow(new Date(conversation.created_at), {
        addSuffix: true,
      });

  if (isRenaming) {
    return (
      <div className="p-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") {
              setNewTitle(conversation.title || "");
              setIsRenaming(false);
            }
          }}
          autoFocus
          className="h-8"
          placeholder="Conversation title..."
        />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-lg p-2 cursor-pointer transition-colors",
          isSelected
            ? "bg-primary/10 text-primary"
            : "hover:bg-muted/50"
        )}
        onClick={onClick}
      >
        <div className="flex-shrink-0">
          <MessageSquare
            className={cn(
              "h-4 w-4",
              isSelected ? "text-primary" : "text-muted-foreground"
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {conversation.is_pinned && (
              <Pin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
            <p
              className={cn(
                "text-sm font-medium truncate",
                isSelected ? "text-primary" : ""
              )}
            >
              {displayTitle}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{conversation.message_count} messages</span>
            <span>·</span>
            <span>{lastMessageTime}</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity",
                isSelected && "opacity-100"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setIsRenaming(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleTogglePin}>
              {conversation.is_pinned ? (
                <>
                  <PinOff className="h-4 w-4 mr-2" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4 mr-2" />
                  Pin
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleArchive}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its
              messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
