/**
 * Share Meeting Button
 *
 * Button that copies the meeting URL to the clipboard with a toast confirmation.
 */

import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareMeetingButtonProps {
  meetingId: string;
  meetingTitle: string;
  slug?: string;
}

export default function ShareMeetingButton({
  meetingId,
  meetingTitle,
  slug,
}: ShareMeetingButtonProps) {
  const handleShare = async () => {
    const url =
      window.location.origin + "/meetings/" + (slug || meetingId);

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Meeting link copied to clipboard", {
        description: meetingTitle,
      });
    } catch {
      toast.error("Failed to copy link to clipboard");
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleShare}>
      <Share2 className="h-4 w-4 mr-1.5" />
      Share
    </Button>
  );
}
