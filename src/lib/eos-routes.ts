/**
 * EOS route helpers — space-aware path resolution.
 */

/** Returns `/eos/ids` or `/eos/issues` based on current pathname. */
export function getEosIssuesBasePath(pathname: string): string {
  return pathname.includes("/eos/ids") ? "/eos/ids" : "/eos/issues";
}

export const EOS_ROUTES = {
  dashboard: "/eos/dashboard",
  vto: "/eos/vto",
  rocks: "/eos/rocks",
  scorecards: "/eos/scorecards",
  ids: "/eos/ids",
  accountability: "/eos/accountability",
  accountabilityChart: "/eos/accountability-chart",
  peopleAnalyzer: "/eos/people-analyzer",
  todos: "/eos/todos",
  analytics: "/eos/analytics",
  l10Meeting: (meetingId: string) => `/eos/meetings/l10/${meetingId}`,
} as const;
