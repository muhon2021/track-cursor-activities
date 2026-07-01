import { 
  Video, 
  FileText, 
  Bot, 
  Users, 
  ShieldCheck, 
  Workflow,
  Sparkles
} from "lucide-react";
import { AIIndicator, AIGradientText } from "@/components/ui/ai-indicator";

const features = [
  {
    icon: Video,
    title: "Meeting Intelligence",
    description:
      "Zoom and Teams recordings auto-transcribed, summarized, and searchable. Action items extracted automatically.",
    isAI: true,
  },
  {
    icon: FileText,
    title: "Private Knowledge Base",
    description:
      "Connect your documents, policies, and client files. AI retrieves context instantly.",
    isAI: true,
  },
  {
    icon: Bot,
    title: "Domain-Specific AI Agents",
    description:
      "Pre-built for legal research, tax questions, contract analysis, financial reporting.",
    isAI: true,
  },
  {
    icon: Users,
    title: "Client Management",
    description:
      "All relationships, communications, and history in one place.",
    isAI: false,
  },
  {
    icon: ShieldCheck,
    title: "Compliance & Audit Trails",
    description:
      "Every AI query logged. Role-based permissions. Built for regulated industries.",
    isAI: true,
  },
  {
    icon: Workflow,
    title: "Workflow Automation",
    description:
      "Automate document generation, reporting, and routine tasks.",
    isAI: true,
  },
];

export function FeatureGrid() {
  return (
    <section className="relative border-y border-border/50 bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      
      <div className="relative mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Complete Platform
            </span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Everything Flows Through <AIGradientText>Control Tower</AIGradientText>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A complete AI-powered platform designed for professional services firms
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className={`group relative overflow-hidden rounded-xl border bg-card p-6 transition-all duration-300 hover:shadow-elevated ${
                feature.isAI ? "hover:border-primary/30" : "hover:border-border"
              }`}
            >
              {/* AI indicator bar for AI-powered features */}
              {feature.isAI && (
                <div className="absolute top-0 left-0 h-1 w-full ai-gradient" />
              )}

              <div className="flex items-start justify-between">
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${
                  feature.isAI 
                    ? "ai-gradient shadow-ai group-hover:scale-105" 
                    : "bg-secondary group-hover:bg-secondary/80"
                }`}>
                  <feature.icon className={`h-6 w-6 ${feature.isAI ? "text-white" : "text-foreground"}`} />
                </div>
                
                {feature.isAI && (
                  <AIIndicator variant="dot" status="active" size="sm" />
                )}
              </div>

              <h3 className="mb-2 text-lg font-bold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
