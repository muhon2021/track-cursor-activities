import { format, parseISO } from "date-fns";
import type { CsaAuditReport } from "@/types/csaAuditReport";
import type { CsaInsightsReport } from "@/lib/api/csaReportsService";
import {
  CSA_AUDIT_BAR_CHARTS,
  CSA_SUMMARY_STATS,
  formatGenerationMetaHtml,
} from "@/lib/csaAuditPresentation";
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function barChartHtml(data: Record<string, number>, color = "#6366f1"): string {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "<p class='muted'>No data</p>";
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return entries
    .map(([label, value]) => {
      const pct = Math.round((value / max) * 100);
      return `<div class="bar-row"><span class="bar-label">${esc(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div><span class="bar-val">${value}</span></div>`;
    })
    .join("");
}

function listHtml(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function snippetsHtml(snippets: { title: string; content: string }[]): string {
  return snippets
    .map(
      (s) =>
        `<div class="snippet"><strong>${esc(s.title)}</strong><pre>${esc(s.content)}</pre></div>`,
    )
    .join("");
}

export function getAuditFromReport(report: CsaInsightsReport): CsaAuditReport | null {
  return (report.insights_json as { audit?: CsaAuditReport })?.audit ?? null;
}

export function buildCsaAuditReportHtml(report: CsaInsightsReport, audit: CsaAuditReport): string {
  const periodLabel = `${format(parseISO(audit.header.period_start), "MMM d, yyyy")} – ${format(parseISO(audit.header.period_end), "MMM d, yyyy")}`;
  const satisfaction = audit.charts.satisfaction_estimate;
  const generationMetaHtml = formatGenerationMetaHtml(report.insights_json?.generation_meta);

  const statsHtml = CSA_SUMMARY_STATS.map(
    (s) =>
      `<div class="stat"><div class="num">${s.getValue(audit.stats_row)}</div><div class="lbl">${esc(s.label)}</div></div>`,
  ).join("");

  const chartsHtml = CSA_AUDIT_BAR_CHARTS.map(({ title, key, htmlColor }) => {
    const data = audit.charts[key] ?? {};
    if (Object.keys(data).length === 0) return "";
    return `<div class="card"><h3>${esc(title)}</h3>${barChartHtml(data, htmlColor)}</div>`;
  }).join("");

  return `<!DOCTYPE html><html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(audit.header.title)} — ${esc(audit.header.display_name)}</title>
  <style>
    :root { --bg:#0f172a; --card:#1e293b; --text:#e2e8f0; --muted:#94a3b8; --accent:#818cf8; --good:#34d399; --warn:#fbbf24; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; background: var(--bg); color: var(--text); margin: 0; line-height: 1.6; }
    .wrap { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
    h1 { font-size: 1.75rem; margin: 0 0 0.25rem; }
    h2 { font-size: 1.25rem; margin: 2rem 0 1rem; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
    h3 { font-size: 1rem; margin: 1rem 0 0.5rem; color: var(--accent); }
    .meta { color: var(--muted); font-size: 0.9rem; }
    .meta.warn { color: var(--warn); font-size: 0.85rem; }
    .nav { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1.5rem 0; }
    .nav a { color: var(--accent); text-decoration: none; font-size: 0.85rem; padding: 0.25rem 0.6rem; border: 1px solid #334155; border-radius: 999px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .stat { background: var(--card); border-radius: 8px; padding: 1rem; text-align: center; }
    .stat .num { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
    .stat .lbl { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
    .card { background: var(--card); border-radius: 8px; padding: 1.25rem; }
    .glance { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .glance h3 { margin-top: 0; }
    .good { color: var(--good); }
    .warn { color: var(--warn); }
    .bar-row { display: grid; grid-template-columns: 120px 1fr 36px; gap: 0.5rem; align-items: center; margin: 0.35rem 0; font-size: 0.85rem; }
    .bar-track { background: #334155; border-radius: 4px; height: 8px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 4px; }
    .bar-label { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-val { text-align: right; font-variant-numeric: tabular-nums; }
    .friction { border-left: 3px solid var(--warn); padding-left: 1rem; margin: 1rem 0; }
    .snippet { margin: 0.75rem 0; }
    .snippet pre { background: #0f172a; padding: 0.75rem; border-radius: 6px; font-size: 0.8rem; overflow-x: auto; white-space: pre-wrap; }
    .muted { color: var(--muted); }
    .satisfaction { font-size: 2rem; font-weight: 700; color: var(--good); }
    footer { margin-top: 3rem; font-size: 0.75rem; color: var(--muted); text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <header id="top">
      <h1>${esc(audit.header.title)}</h1>
      <p class="meta">${esc(audit.header.display_name)} · ${periodLabel}</p>
      <p class="meta">${audit.header.total_messages} prompts · ${audit.header.total_sessions} sessions</p>
      ${generationMetaHtml}
    </header>
    <nav class="nav">
      <a href="#glance">At a Glance</a>
      <a href="#stats">Stats</a>
      <a href="#work">Work</a>
      <a href="#charts">Charts</a>
      <a href="#usage">Usage</a>
      <a href="#wins">Wins</a>
      <a href="#friction">Friction</a>
      <a href="#features">Features</a>
      <a href="#new-ways">New Ways</a>
      <a href="#horizon">Horizon</a>
    </nav>

    <section id="glance">
      <h2>At a Glance</h2>
      <div class="glance">
        <div class="card"><h3 class="good">What is working</h3>${listHtml(audit.at_a_glance.working)}</div>
        <div class="card"><h3 class="warn">What is hindering</h3>${listHtml(audit.at_a_glance.hindering)}</div>
        <div class="card"><h3>Quick wins</h3>${listHtml(audit.at_a_glance.quick_wins)}</div>
        <div class="card"><h3>Ambitious workflows</h3>${listHtml(audit.at_a_glance.ambitious)}</div>
      </div>
    </section>

    <section id="stats">
      <h2>Summary Statistics</h2>
      <div class="stats">
        ${statsHtml}
      </div>    </section>

    <section id="work">
      <h2>What You Work On</h2>
      <p>${esc(audit.what_you_work_on.themes)}</p>
      ${audit.what_you_work_on.areas
        .map(
          (a) =>
            `<div class="card" style="margin:0.75rem 0"><strong>${esc(a.name)}</strong> — ${a.sessions} session(s)<br/><span class="muted">${esc(a.description)}</span></div>`,
        )
        .join("")}
    </section>

    <section id="charts">
      <h2>Usage Charts</h2>
      <div class="grid-2">
        ${chartsHtml}
        <div class="card"><h3>Satisfaction estimate</h3><div class="satisfaction">${satisfaction}%</div><p class="muted">AI-estimated productivity alignment</p></div>
      </div>
    </section>
    <section id="usage">
      <h2>How You Use Cursor</h2>
      <p>${esc(audit.how_you_use_cursor.narrative)}</p>
      <h3>Behavior patterns</h3>${listHtml(audit.how_you_use_cursor.behavior_patterns)}
      <p><strong>Key insight:</strong> ${esc(audit.how_you_use_cursor.key_insight)}</p>
    </section>

    <section id="wins">
      <h2>Impressive Things You Did</h2>
      <div class="grid-2">
        <div class="card"><h3>Positive patterns</h3>${listHtml(audit.impressive_things.patterns)}</div>
        <div class="card"><h3>Strong workflows</h3>${listHtml(audit.impressive_things.workflows)}</div>
      </div>
      <h3>Effective prompting examples</h3>${listHtml(audit.impressive_things.prompting_examples)}    </section>

    <section id="friction">
      <h2>Where Things Go Wrong</h2>
      ${audit.where_things_go_wrong.categories
        .map(
          (c) =>
            `<div class="friction"><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><p><strong>Examples:</strong> ${esc(c.examples.join("; "))}</p><p><strong>Mitigation:</strong> ${esc(c.mitigation)}</p></div>`,
        )
        .join("")}
    </section>

    <section id="features">
      <h2>Existing Features to Try</h2>
      <h3>Cursor rules</h3>${listHtml(audit.existing_features.cursor_rules)}
      <h3>Workflow recommendations</h3>${listHtml(audit.existing_features.workflow_recommendations)}
      <h3>Custom prompts</h3>${snippetsHtml(audit.existing_features.custom_prompts)}
      <h3>Copyable snippets</h3>${snippetsHtml(audit.existing_features.copyable_snippets)}
    </section>

    <section id="new-ways">
      <h2>New Ways to Use Cursor</h2>
      <h3>Suggested workflows</h3>${listHtml(audit.new_ways.workflows)}
      <h3>Prompt templates</h3>${snippetsHtml(audit.new_ways.prompt_templates)}
    </section>

    <section id="horizon">
      <h2>On the Horizon</h2>
      ${listHtml(audit.on_the_horizon)}
    </section>

    <footer>Generated ${format(new Date(report.generated_at), "PPpp")} · Cursor Self Analyser · SJ Innovation</footer>
  </div>
</body>
</html>`;
}

export function downloadCsaAuditHtml(report: CsaInsightsReport, audit: CsaAuditReport): void {
  const html = buildCsaAuditReportHtml(report, audit);
  const name = (audit.header.display_name || "user").replace(/\s+/g, "-").toLowerCase();
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cursor-audit-${name}-${audit.header.period_end}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
