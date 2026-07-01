/**
 * Redirects /tasks/streams/:id to /tasks/stream/:slug.
 * Resolves stream by id to get slug; if slug missing, redirects to /tasks/stream/:id.
 */
import { useParams, Navigate } from "react-router-dom";
import { useTaskStream } from "../hooks/useTaskStreams";

export function StreamRedirect() {
  const { id } = useParams<{ id: string }>();
  const { data: stream, isLoading } = useTaskStream(id);

  if (!id) return null;
  if (isLoading) return <div className="p-4">Loading...</div>;
  const slug = stream?.slug || stream?.id || id;
  return <Navigate to={`/tasks/stream/${slug}`} replace />;
}
