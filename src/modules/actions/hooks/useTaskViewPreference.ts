/**
 * Persist default "My Tasks" tab in localStorage.
 * Key: tasks-default-view. Values: today | this_week | overdue | delegated | all | streams
 */
const STORAGE_KEY = "tasks-default-view";

export type TaskDefaultView =
  | "today"
  | "this_week"
  | "overdue"
  | "delegated"
  | "all"
  | "streams";

export function useTaskViewPreference() {
  const getDefaultView = (): TaskDefaultView => {
    if (typeof window === "undefined") return "all";
    const raw = localStorage.getItem(STORAGE_KEY);
    if (
      raw &&
      ["today", "this_week", "overdue", "delegated", "all", "streams"].includes(raw)
    ) {
      return raw as TaskDefaultView;
    }
    return "all";
  };

  const setDefaultView = (view: TaskDefaultView) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, view);
  };

  return { defaultView: getDefaultView(), setDefaultView };
}
