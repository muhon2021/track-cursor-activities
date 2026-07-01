import { Check, X, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { AIGradientText, AIIndicator } from "@/components/ui/ai-indicator";

const comparisonData = [
  {
    feature: "Annual Cost (20 users)",
    chatgpt: "$108,000+",
    copilot: "$7,200+",
    controlTower: "Starting at $4,000",
    highlight: true,
  },
  {
    feature: "Private/On-Prem Option",
    chatgpt: false,
    copilot: false,
    controlTower: true,
  },
  {
    feature: "Domain-Specific Agents",
    chatgpt: false,
    copilot: false,
    controlTower: true,
  },
  {
    feature: "Full Audit Trails",
    chatgpt: "Limited",
    copilot: "Limited",
    controlTower: true,
  },
  {
    feature: "No Seat Minimums",
    chatgpt: false,
    copilot: false,
    controlTower: true,
  },
];

function CellValue({ value, isControlTower = false }: { value: boolean | string; isControlTower?: boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <div className={`flex h-6 w-6 items-center justify-center rounded-full ${isControlTower ? "ai-gradient" : "bg-primary/10"}`}>
        <Check className={`h-3.5 w-3.5 ${isControlTower ? "text-white" : "text-primary"}`} />
      </div>
    ) : (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
        <X className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
    );
  }
  return <span className={`text-sm ${isControlTower ? "font-bold text-primary" : ""}`}>{value}</span>;
}

export function PricingPreview() {
  return (
    <section className="border-y border-border/50 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Pricing
            </span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Enterprise AI <AIGradientText>Without Enterprise Pricing</AIGradientText>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Get all the power without the bloated costs
          </p>
        </div>

        {/* Comparison Table */}
        <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
          {/* Table Header */}
          <div className="grid grid-cols-4 gap-4 border-b border-border bg-muted/30 p-5 text-sm font-bold">
            <div></div>
            <div className="text-center text-muted-foreground">ChatGPT Enterprise</div>
            <div className="text-center text-muted-foreground">Microsoft Copilot</div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-primary">
                <AIIndicator variant="dot" size="sm" />
                Control Tower
              </div>
            </div>
          </div>

          {/* Table Body */}
          {comparisonData.map((row, index) => (
            <div
              key={index}
              className={`grid grid-cols-4 gap-4 border-b border-border/50 p-5 last:border-0 transition-colors ${
                row.highlight ? "bg-primary/5" : "hover:bg-muted/20"
              }`}
            >
              <div className="text-sm font-semibold text-foreground">{row.feature}</div>
              <div className="flex items-center justify-center text-muted-foreground">
                <CellValue value={row.chatgpt} />
              </div>
              <div className="flex items-center justify-center text-muted-foreground">
                <CellValue value={row.copilot} />
              </div>
              <div className="flex items-center justify-center font-medium text-foreground">
                <CellValue value={row.controlTower} isControlTower />
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Button 
            size="lg" 
            className="btn-primary-bold h-12 rounded-full px-8 font-semibold text-white border-0" 
            asChild
          >
            <Link to="/pricing">
              See Full Pricing
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
