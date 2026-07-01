import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Cloud, Loader2, Link as LinkIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface GoogleDriveFilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function GoogleDriveFilePicker({
  open,
  onOpenChange,
  onSuccess,
}: GoogleDriveFilePickerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [folderUrl, setFolderUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");

  const handleConnect = async () => {
    if (!folderUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Google Drive folder URL",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    setConnectionStatus("idle");

    try {
      // Call google-drive-sync edge function
      const { data, error } = await supabase.functions.invoke('google-drive-sync', {
        body: {
          folder_url: folderUrl,
          user_id: user?.id,
        },
      });

      if (error) throw error;

      setConnectionStatus("success");
      toast({
        title: "Success",
        description: "Google Drive folder connected successfully",
      });

      if (onSuccess) {
        onSuccess();
      }

      // Close dialog after a brief delay
      setTimeout(() => {
        onOpenChange(false);
        setFolderUrl("");
        setConnectionStatus("idle");
      }, 1500);
    } catch (error: any) {
      console.error("Google Drive connection error:", error);
      setConnectionStatus("error");

      // Check if it's a 501 Not Implemented error
      if (error.message?.includes("501") || error.message?.includes("Not Implemented")) {
        toast({
          title: "Feature Not Configured",
          description: "Google Drive integration requires OAuth setup. Please configure the google-drive-sync edge function.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: error.message || "Failed to connect to Google Drive. Please check the folder URL and try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Connect Google Drive
          </DialogTitle>
          <DialogDescription>
            Connect a Google Drive folder to automatically sync files to your knowledge base
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Note:</strong> Google Drive integration requires OAuth configuration.
              Make sure the google-drive-sync edge function is properly set up with credentials.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="folder-url">Google Drive Folder URL</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="folder-url"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={folderUrl}
                  onChange={(e) => setFolderUrl(e.target.value)}
                  className="pl-9"
                  disabled={isConnecting}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste the shareable link to your Google Drive folder
            </p>
          </div>

          {connectionStatus === "success" && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm text-green-600">
                Successfully connected to Google Drive!
              </AlertDescription>
            </Alert>
          )}

          {connectionStatus === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Failed to connect. Please verify the URL and OAuth configuration.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-medium">How to get the folder URL:</h4>
            <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
              <li>Open Google Drive and navigate to the folder</li>
              <li>Click the "Share" button</li>
              <li>Set sharing to "Anyone with the link can view"</li>
              <li>Copy the link and paste it above</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={isConnecting || !folderUrl.trim()}>
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Cloud className="mr-2 h-4 w-4" />
                Connect Folder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
