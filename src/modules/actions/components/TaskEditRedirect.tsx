/**
 * Redirects /tasks/:id/edit to /tasks/:id (task detail page).
 */
import { useParams, Navigate } from "react-router-dom";

export function TaskEditRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <Navigate to={`/tasks/${id}`} replace />;
}
