import { format, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, Copy, Download, Lightbulb, Rocket, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { CsaInsightsReport } from "@/lib/api/csaReportsService";
import type { CsaAuditReport } from "@/types/csaAuditReport";
import { CSA_AUDIT_SECTIONS } from "@/types/csaAuditReport";
import { CSA_SUMMARY_STATS, formatGenerationMetaNote } from "@/lib/csaAuditPresentation";
import { CsaAuditChartsPanel } from "./CsaAuditCharts";
import { downloadCsaAuditHtml } from "@/lib/csaAuditReportHtml";

interface CsaAuditReportViewProps {
  report: CsaInsightsReport;
  audit: CsaAuditReport;
}

function CopySnippet({ title, content }: { title: string; content: string }) {
  const copy = () => {
    navigator.clipboard.writeText(content);
    toast.success(`Copied: ${title}`);
  };
  return (
    <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <Button variant="ghost" size="sm" onClick={copy}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{content}</pre>
    </div>
  );
}

export function CsaAuditReportView({ report, audit }: CsaAuditReportViewProps) {
  const periodLabel = `${format(parseISO(audit.header.period_start), "MMM d, yyyy")} – ${format(parseISO(audit.header.period_end), "MMM d, yyyy")}`;
  const generationMeta = report.insights_json?.generation_meta;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{audit.header.title}</h1>
            <p className="text-muted-foreground">
              {audit.header.display_name} · {periodLabel}
            </p>
            <p className="text-sm text-muted-foreground">
              {audit.header.total_messages} prompts · {audit.header.total_sessions} sessions
            </p>
            {(() => {
              const note = formatGenerationMetaNote(generationMeta);
              if (!note) return null;
              return (
                <p
                  className={
                    generationMeta?.source === "heuristic"
                      ? "text-xs text-amber-600 dark:text-amber-500"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {note}
                </p>
              );
            })()}
          </div>
          <Button variant="default" size="sm" onClick={() => downloadCsaAuditHtml(report, audit)}>
            <Download className="h-4 w-4 mr-2" />
            Download HTML
          </Button>
        </div>
        <nav className="flex flex-wrap gap-2 pt-2">
          {CSA_AUDIT_SECTIONS.map((s) => (
            <Button key={s.id} variant="outline" size="sm" className="h-7 text-xs" onClick={() => scrollTo(s.id)}>
              {s.label}
            </Button>
          ))}
        </nav>
      </header>

      <section id="glance" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold">At a Glance</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> What is working
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                {audit.at_a_glance.working.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" /> What is hindering
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                {audit.at_a_glance.hindering.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" /> Quick wins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                {audit.at_a_glance.quick_wins.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Rocket className="h-4 w-4" /> Ambitious workflows
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                {audit.at_a_glance.ambitious.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="stats" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold">Summary Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CSA_SUMMARY_STATS.map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold">{s.getValue(audit.stats_row)}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="work" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold">What You Work On</h2>
        <p className="text-sm text-muted-foreground">{audit.what_you_work_on.themes}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {audit.what_you_work_on.areas.map((area) => (
            <Card key={area.name}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{area.name}</CardTitle>
                  <Badge variant="secondary">{area.sessions} sessions</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{area.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="charts" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold">Usage Charts</h2>
        <CsaAuditChartsPanel charts={audit.charts} />
      </section>

      <section id="usage" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold">How You Use Cursor</h2>
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm">{audit.how_you_use_cursor.narrative}</p>
            <div>
              <h3 className="text-sm font-medium mb-2">Behavior patterns</h3>
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                {audit.how_you_use_cursor.behavior_patterns.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <p className="text-sm">
              <span className="font-medium">Key insight:</span> {audit.how_you_use_cursor.key_insight}
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="wins" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> Impressive Things You Did
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Positive patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                {audit.impressive_things.patterns.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Strong workflows</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                {audit.impressive_things.workflows.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Effective prompting examples</h3>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            {audit.impressive_things.prompting_examples.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="friction" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold">Where Things Go Wrong</h2>
        <div className="space-y-4">
          {audit.where_things_go_wrong.categories.map((cat) => (
            <Card key={cat.id} className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{cat.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{cat.description}</p>
                {cat.examples.length > 0 && (
                  <p>
                    <span className="font-medium text-foreground">Examples:</span> {cat.examples.join(" · ")}
                  </p>
                )}
                <p>
                  <span className="font-medium text-foreground">Mitigation:</span> {cat.mitigation}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="features" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="h-5 w-5" /> Existing Features to Try
        </h2>
        <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
          {audit.existing_features.cursor_rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <h3 className="text-sm font-medium">Workflow recommendations</h3>
        <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
          {audit.existing_features.workflow_recommendations.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <div className="grid gap-3 md:grid-cols-2">
          {audit.existing_features.custom_prompts.map((s) => (
            <CopySnippet key={s.title} title={s.title} content={s.content} />
          ))}
          {audit.existing_features.copyable_snippets.map((s) => (
            <CopySnippet key={s.title} title={s.title} content={s.content} />
          ))}
        </div>
      </section>

      <section id="new-ways" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold">New Ways to Use Cursor</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
          {audit.new_ways.workflows.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <div className="grid gap-3 md:grid-cols-2">
          {audit.new_ways.prompt_templates.map((t) => (
            <CopySnippet key={t.title} title={t.title} content={t.content} />
          ))}
        </div>
      </section>

      <section id="horizon" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold">On the Horizon</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
          {audit.on_the_horizon.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
