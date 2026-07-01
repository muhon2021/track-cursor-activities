import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Lock, Server, Sparkles } from "lucide-react";
import { AIIndicator, AIGradientText } from "@/components/ui/ai-indicator";

export function FinalCTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
      <div className="relative overflow-hidden rounded-3xl bg-ai-mesh border border-primary/20">
        {/* Background decorations */}
        <div className="absolute top-0 left-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        
        <div className="relative px-8 py-16 sm:px-16 sm:py-24 text-center">
          {/* AI Status */}
          <div className="mb-6 flex items-center justify-center gap-3">
            <AIIndicator variant="badge" status="active" size="lg" />
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Your Firm's Own AI.
            <span className="block mt-2">
              <AIGradientText>Behind Your Firewall.</AIGradientText>
            </span>
          </h2>
          
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Join forward-thinking law firms, accounting practices, and healthcare groups 
            who are already using AI — without compromising client confidentiality.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button 
              size="lg" 
              className="btn-primary-bold h-14 rounded-full px-10 text-base font-bold text-white border-0"
              asChild
            >
              <a href="/login" target="_blank" rel="noopener noreferrer">
                <Sparkles className="mr-2 h-5 w-5" />
                Schedule a Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="h-14 rounded-full px-10 text-base font-semibold bg-background/80 backdrop-blur-sm border-2"
              asChild
            >
              <a href="/login" target="_blank" rel="noopener noreferrer">
                Talk to Sales
              </a>
            </Button>
          </div>

          {/* Trust Badges with AI styling */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2 rounded-full bg-card/80 backdrop-blur-sm border border-border px-5 py-2.5 shadow-soft">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-card/80 backdrop-blur-sm border border-border px-5 py-2.5 shadow-soft">
              <Lock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">HIPAA Ready</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-card/80 backdrop-blur-sm border border-border px-5 py-2.5 shadow-soft">
              <Server className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Your Data Stays Private</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
