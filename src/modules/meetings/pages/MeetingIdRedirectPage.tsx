/**
 * Meeting ID Redirect Page
 *
 * Redirects UUID-based meeting URLs to slug-based URLs.
 * If a slug is found for the given meeting ID, navigates to /meetings/:slug.
 * Otherwise falls through to the detail page by ID.
 */

import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function MeetingIdRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, error, isLoading } = useQuery({
    queryKey: ["meeting-slug-lookup", id],
    queryFn: async () => {
      const { data: meeting, error } = await supabase
        .from("meetings")
        .select("slug")
        .eq("id", id!)
        .single();

      if (error) throw error;
      return meeting as { slug: string | null };
    },
    enabled: !!id && UUID_REGEX.test(id),
    retry: false,
  });

  useEffect(() => {
    if (!id) {
      navigate("/meetings", { replace: true });
      return;
    }

    // If the id is not a UUID, it may already be a slug; navigate directly
    if (!UUID_REGEX.test(id)) {
      navigate(`/meetings/${id}`, { replace: true });
      return;
    }

    if (error) {
      toast.error("Meeting not found", {
        description: "The requested meeting could not be found.",
      });
      navigate("/meetings", { replace: true });
      return;
    }

    if (!isLoading && data) {
      if (data.slug) {
        navigate(`/meetings/${data.slug}`, { replace: true });
      } else {
        navigate(`/meetings/${id}`, { replace: true });
      }
    }
  }, [id, data, error, isLoading, navigate]);

  return (
    <div className="flex h-96 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
