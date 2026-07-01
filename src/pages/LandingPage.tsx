import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  LayoutDashboard,
  Search,
  Mic,
  FileText,
  Brain,
  Plug,
  ShieldCheck,
  KeyRound,
  Lock,
  Database,
  Server,
  Network,
  Eye,
  BookOpen,
  Bot,
  Check,
} from "lucide-react";

const BOOK_DEMO_URL = "/login";

const tools = [
  "HubSpot", "Salesforce", "Zoho CRM", "Pipedrive",
  "Jira", "ClickUp", "ActiveCollab", "Confluence",
  "Zoom", "Teams", "Google Meet", "Slack",
  "Drive", "SharePoint", "Outlook", "MCP",
];

const categories = [
  { label: "CRM", items: "HubSpot · Salesforce · Zoho · Pipedrive" },
  { label: "Project trackers", items: "Jira · ClickUp · ActiveCollab" },
  { label: "Meetings", items: "Zoom · Teams · Google Meet" },
  { label: "Docs", items: "Confluence · SharePoint · Drive" },
  { label: "Comms", items: "Outlook · Slack" },
];

const towerFeatures = [
  "Unified Analytics Dashboard",
  "Cross-app Semantic Search",
  "Agent-Ready Context",
  "Auto-generated Briefs & Decks",
];

const differentiators = [
  {
    n: "01",
    icon: Eye,
    title: "Unified View",
    body: "Every app, every metric, in one analytical dashboard. Stop pivoting between 10 tabs to answer one question.",
  },
  {
    n: "02",
    icon: BookOpen,
    title: "Knowledge Base",
    body: "A pgVector-powered KB that ingests meetings, docs, projects, deals, and tasks — so search and agents already know your work.",
  },
  {
    n: "03",
    icon: Bot,
    title: "Agentic Action",
    body: "24+ specialized AI agents read from your KB and act across connected systems — not just chat, real work.",
  },
];

const capabilities = [
  { icon: LayoutDashboard, title: "Unified Analytics", body: "Cross-app KPIs, pipelines, and project health on one screen." },
  { icon: Search, title: "Semantic Search", body: "Ask a question — get answers from every tool you've connected." },
  { icon: Mic, title: "Auto-Indexed Meetings", body: "Zoom, Teams, Meet transcripts become searchable knowledge instantly." },
  { icon: FileText, title: "Generated Artifacts", body: "Decks, briefs, exec summaries created from your real org data." },
  { icon: Brain, title: "Agent-Ready Context", body: "Every agent gets RAG context from your Knowledge Base." },
  { icon: Plug, title: "MCP & Integrations", body: "20+ native connectors plus MCP for anything custom." },
];

const agents = [
  { name: "Deal Coach", body: "Coaches reps mid-pipeline using CRM + meetings." },
  { name: "Meeting Summarizer", body: "Action items, decisions, owners — auto-extracted." },
  { name: "Project Risk Analyst", body: "Flags blocked work across Jira, ClickUp, AC." },
  { name: "KB Search Agent", body: "Cross-app semantic answers with citations." },
  { name: "Exec Briefer", body: "Generates board-ready briefs from live org data." },
  { name: "Lead Follow-up Writer", body: "Drafts hybrid emails grounded in deal context." },
  { name: "Confluence/Drive Curator", body: "Surfaces stale docs, suggests updates." },
  { name: "EOS Triage Wizard", body: "Converts transcripts into issues, OKRs, todos." },
];

const trust = [
  { icon: KeyRound, title: "SSO", body: "Google Workspace · Azure AD · SAML 2.0" },
  { icon: FileText, title: "Audit logs", body: "Every AI call, every tool action, fully traceable." },
  { icon: Lock, title: "Signed-URL storage", body: "No public buckets; 1-hour expiring access." },
  { icon: Database, title: "Multi-tenant RLS", body: "Postgres row-level security on every table." },
  { icon: Server, title: "Private deployment", body: "On-prem or your VPC — your data never leaves." },
  { icon: ShieldCheck, title: "Your keys, your models", body: "BYOK for OpenAI, Anthropic, Google, Azure." },
];

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
            <Network className="h-4 w-4 text-primary-foreground" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-accent ring-2 ring-background" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-lg font-bold tracking-tight text-foreground">Control Tower</span>
            <span className="text-sm font-semibold text-primary">Control Tower</span>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 lg:flex">
          <a href="#problem" className="text-sm font-medium text-muted-foreground hover:text-foreground">Problem</a>
          <a href="#capabilities" className="text-sm font-medium text-muted-foreground hover:text-foreground">Capabilities</a>
          <a href="#integrations" className="text-sm font-medium text-muted-foreground hover:text-foreground">Integrations</a>
          <a href="#agents" className="text-sm font-medium text-muted-foreground hover:text-foreground">Agents</a>
          <a href="#trust" className="text-sm font-medium text-muted-foreground hover:text-foreground">Trust</a>
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md shadow-primary/30 hover:opacity-90">
            <a href={BOOK_DEMO_URL} target="_blank" rel="noopener noreferrer">
              Book demo <ArrowRight className="ml-1.5 h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/40">
      {/* Gradient mesh */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-32 top-40 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute left-1/3 top-2/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-28 pt-20 lg:pb-36 lg:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            CONTROL TOWER · CONTROL TOWER
          </div>

          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            One Control Tower for{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              every tool
            </span>{" "}
            your team already uses.
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Unify your CRM, project tracker, meetings, and docs into one analytical view —
            powered by a Knowledge Base that already knows your work.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild className="rounded-full bg-gradient-to-r from-primary to-accent px-8 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/30 hover:opacity-95">
              <a href={BOOK_DEMO_URL} target="_blank" rel="noopener noreferrer">
                Book a 20-min demo <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild className="rounded-full px-8 text-base font-semibold">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground"></p>
        </div>

        {/* Tool strip */}
        <div className="mt-20 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {tools.slice(0, 8).map((t) => (
            <div key={t} className="rounded-xl border border-border/60 bg-card/60 px-3 py-3 text-center text-xs font-medium text-muted-foreground backdrop-blur">
              {t}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section id="problem" className="border-b border-border/40 bg-muted/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">THE PROBLEM</p>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Your data lives in 10+ tools. <br />
          <span className="text-muted-foreground">None of them talk to each other.</span>
        </h2>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {tools.slice(0, 14).map((t) => (
              <div key={t} className="rounded-lg border border-border bg-card px-3 py-2.5 text-center text-xs font-medium text-foreground">
                {t}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-8">
            <div className="font-display text-7xl font-bold text-primary">6+</div>
            <p className="mt-3 text-sm font-semibold text-foreground">
              apps your team checks to answer one business question.
            </p>
            <p className="mt-3 text-sm italic text-muted-foreground">
              Decisions get made blind. Reports take days. Context is always one tab away.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Fix() {
  return (
    <section className="border-b border-border/40 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">THE FIX</p>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          One place to see everything.
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Control Tower pulls live data from every connected app and renders it as one analytical view —
          deals, projects, meetings, KPIs, side by side.
        </p>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Connects to</p>
            <ul className="mt-5 space-y-4">
              {categories.map((c) => (
                <li key={c.label} className="flex gap-3 border-b border-border/60 pb-3 last:border-0">
                  <span className="font-display text-sm font-semibold text-foreground">{c.label}</span>
                  <span className="text-sm text-muted-foreground">{c.items}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-accent/5 p-8 shadow-xl shadow-primary/10">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Control Tower</p>
            <ul className="mt-5 space-y-3">
              {towerFeatures.map((f) => (
                <li key={f} className="flex items-center gap-3 text-base font-medium text-foreground">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm italic text-muted-foreground">
              We don't replace your stack. We make it visible.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Differentiators() {
  return (
    <section className="border-b border-border/40 bg-muted/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">WHAT MAKES IT DIFFERENT</p>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Three things no other platform matches.
        </h2>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {differentiators.map((d) => (
            <div key={d.title} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
              <div className="absolute right-6 top-6 font-display text-5xl font-bold text-muted/40">{d.n}</div>
              <d.icon className="h-9 w-9 text-primary" />
              <h3 className="mt-6 font-display text-xl font-bold text-foreground">{d.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{d.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Capabilities() {
  return (
    <section id="capabilities" className="border-b border-border/40 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">IT DOES THE WORK</p>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          It doesn't just show data. <span className="text-muted-foreground">It does the work.</span>
        </h2>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border bg-card p-7 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-foreground">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModelAgnostic() {
  return (
    <section className="border-b border-border/40 bg-gradient-to-br from-primary/5 via-background to-accent/5 py-24">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">MODEL-AGNOSTIC</p>
        <h2 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
          One Knowledge Base. <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Every model.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Auto-routed for the task, or hand-pick the model. All providers read from the same Knowledge Base —
          switch models without losing context.
        </p>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          {["OpenAI", "Anthropic Claude", "Google Gemini"].map((p) => (
            <div key={p} className="rounded-full border border-border bg-card px-6 py-3 font-display text-base font-semibold text-foreground shadow-sm">
              {p}
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-primary/30 bg-card/60 px-6 py-5 text-sm text-muted-foreground backdrop-blur">
          Shared <span className="font-semibold text-foreground">pgVector Knowledge Base</span> · org memory · per-user memory · prompt templates · agent personalizations
        </div>
      </div>
    </section>
  );
}

function Integrations() {
  return (
    <section id="integrations" className="border-b border-border/40 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">CONNECTED</p>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Connected to everything you already use.
        </h2>
        <p className="mt-4 max-w-2xl italic text-muted-foreground">
          We don't replace your stack. We make it visible — and intelligent.
        </p>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {tools.map((t) => (
            <div key={t} className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 font-display text-lg font-bold text-primary">
                {t[0]}
              </div>
              <span className="text-xs font-medium text-foreground">{t}</span>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          + MCP servers for anything custom · OAuth · API keys · webhooks
        </p>
      </div>
    </section>
  );
}

function Agents() {
  return (
    <section id="agents" className="border-b border-border/40 bg-muted/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">AGENTS</p>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          24+ specialized agents <span className="text-muted-foreground">read from your unified KB.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Pre-seeded, production-ready, scoped to your data with RLS.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {agents.map((a) => (
            <div key={a.name} className="rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/40">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                <h3 className="font-display text-base font-bold text-foreground">{a.name}</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{a.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm font-medium text-primary">
          +16 more — Sales, Ops, EOS, Knowledge, Productivity, BD.
        </p>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section id="trust" className="border-b border-border/40 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">TRUST</p>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Enterprise-grade by default.
        </h2>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trust.map((t) => (
            <div key={t.title} className="rounded-2xl border border-border bg-card p-7">
              <t.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-5 font-display text-lg font-bold text-foreground">{t.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-1/4 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-accent/20 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">LET'S TALK</p>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-6xl">
          See your scattered tools become{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">one Control Tower.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Book a 20-minute demo. We'll connect one of your tools live and show you the unified view in under 10 minutes.
        </p>
        <div className="mt-10">
          <Button size="lg" asChild className="rounded-full bg-gradient-to-r from-primary to-accent px-10 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/30 hover:opacity-95">
            <a href={BOOK_DEMO_URL} target="_blank" rel="noopener noreferrer">
              Book a 20-min demo <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground"></p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">Control Tower</span> · Control Tower
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          <a href={BOOK_DEMO_URL} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">Book demo</a>
          <Link to="/terms-and-conditions" className="text-muted-foreground hover:text-foreground">Terms</Link>
          <Link to="/privacy-policy" className="text-muted-foreground hover:text-foreground">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Fix />
        <Differentiators />
        <Capabilities />
        <ModelAgnostic />
        <Integrations />
        <Agents />
        <Trust />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
