/** Interpolate {{variable}} placeholders in notification templates */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`);
}

export function previewTemplate(
  subject: string,
  body: string,
  sampleVars: Record<string, string> = {
    user: "Jane Doe",
    task: "Review Q3 Report",
    meeting: "Weekly Standup",
    department: "Engineering",
    rock: "Launch MVP",
  }
) {
  return {
    subject: interpolateTemplate(subject, sampleVars),
    body: interpolateTemplate(body, sampleVars),
  };
}
