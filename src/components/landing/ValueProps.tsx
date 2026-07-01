import { Brain, Shield, Building2, Sparkles } from "lucide-react";
import { AIIndicator, AIGradientText } from "@/components/ui/ai-indicator";

const valueProps = [
  {
    icon: Brain,
    title: "AI Agents Come to You",
    description:
      "No more switching between 5 different AI tools. Your specialized agents — Legal Research, Tax Advisor, Contract Analyzer — all live in one place.",
    aiStatus: "active" as const,
  },
  {
    icon: Shield,
    title: "Your Data. Your Firewall.",
    description:
      "Deploy on-premises or in your private cloud. Client files, patient records, financial data — nothing ever leaves your environment.",
    aiStatus: "learning" as const,
  },
  {
    icon: Building2,
    title: "One Dashboard Per Department",
    description:
      "Each team gets their own private workspace. Legal. Accounting. Operations. All connected. All controlled.",
    aiStatus: "thinking" as const,
  },
];

export function ValueProps() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            AI-First Platform
          </span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          Your <AIGradientText>AI Control Center</AIGradientText>
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Built for professional services firms that demand privacy, compliance, and efficiency
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-3">
        {valueProps.map((prop, index) => (
          <div 
            key={index} 
            className="ai-card group p-8 transition-all duration-300 hover:shadow-ai"
          >
            {/* AI Status Indicator */}
            <div className="absolute top-4 right-4">
              <AIIndicator variant="dot" status={prop.aiStatus} size="sm" />
            </div>

            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ai-gradient shadow-ai transition-transform group-hover:scale-105">
              <prop.icon className="h-7 w-7 text-white" />
            </div>
            <h3 className="mb-3 text-xl font-bold text-foreground">
              {prop.title}
            </h3>
            <p className="leading-relaxed text-muted-foreground">
              {prop.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
