import { Check, X, Sparkles } from "lucide-react";
import { AIGradientText } from "@/components/ui/ai-indicator";

const comparisons = [
  {
    problem: "ChatGPT banned at your firm — confidentiality risk",
    solution: "AI runs behind YOUR firewall",
  },
  {
    problem: "Juggling Excel, Docs, Zoom notes, and emails",
    solution: "One unified dashboard",
  },
  {
    problem: "$60/user/month with 150-seat minimums",
    solution: "Flat annual pricing, no minimums",
  },
  {
    problem: "Generic AI that doesn't understand your industry",
    solution: "Pre-built agents for law, accounting, healthcare, banking",
  },
  {
    problem: "No audit trail for compliance officers",
    solution: "Full logging and role-based access",
  },
  {
    problem: "Meeting summaries lost in email threads",
    solution: "Auto-transcribed, searchable, actionable",
  },
];

export function ProblemSolution() {
  return (
    <section className="border-y border-border/50 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Before & After
            </span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Replace the Chaos with <AIGradientText>One Command Center</AIGradientText>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            See how Control Tower transforms the way professional services firms use AI
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <div className="grid gap-4">
            {/* Header */}
            <div className="grid grid-cols-2 gap-4 pb-2 text-sm font-bold">
              <div className="flex items-center gap-2 pl-4 text-destructive">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10">
                  <X className="h-3.5 w-3.5" />
                </div>
                The Old Way
              </div>
              <div className="flex items-center gap-2 pl-4 text-primary">
                <div className="flex h-6 w-6 items-center justify-center rounded-full ai-gradient">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
                With Control Tower
              </div>
            </div>

            {/* Comparison Rows */}
            {comparisons.map((item, index) => (
              <div 
                key={index} 
                className="group grid grid-cols-2 gap-4 rounded-xl border border-border/50 bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-ai"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                    <X className="h-3 w-3 text-destructive" />
                  </div>
                  <span className="text-sm text-muted-foreground">{item.problem}</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ai-gradient">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{item.solution}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
