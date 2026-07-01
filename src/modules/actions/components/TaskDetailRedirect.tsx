/**
 * Redirects /tasks/t/:slug to /tasks/:slug (legacy URL support).
 */
import { useParams, Navigate } from "react-router-dom";

export function TaskDetailRedirect() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return null;
  return <Navigate to={`/tasks/${slug}`} replace />;
}
