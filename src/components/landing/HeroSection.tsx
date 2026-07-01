import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Lock, Sparkles, Zap, Brain } from "lucide-react";
import { AIIndicator, AIPoweredBadge, AIGradientText } from "@/components/ui/ai-indicator";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-ai-mesh">
      {/* Background grid pattern */}
      <div className="absolute inset-0 -z-10 bg-grid-pattern opacity-40" />
      
      {/* Floating orbs for visual interest */}
      <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      
      <div className="mx-auto max-w-7xl px-6 py-24 lg:py-36">
        <div className="mx-auto max-w-4xl text-center">
          {/* AI Status Badge */}
          <div className="mb-8 flex items-center justify-center gap-4">
            <AIPoweredBadge size="lg" />
            <span className="text-sm font-medium text-muted-foreground">
              Trusted by 500+ Financial & Legal Firms
            </span>
          </div>

          {/* Main Headline with AI Gradient */}
          <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl">
            <span className="text-foreground">Your AI Agents.</span>
            <br />
            <AIGradientText as="span" className="block mt-2">
              One Control Center.
            </AIGradientText>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-xl text-xl font-semibold text-foreground sm:text-2xl">
            Private. Secure. Enterprise-Ready.
          </p>

          {/* Description */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Stop switching between ChatGPT, Excel, Slack, and scattered notes.
            Control Tower brings intelligent AI agents directly into your workflow—
            with your data staying <strong className="text-foreground">100% behind your firewall</strong>.
          </p>

          {/* CTAs with AI styling */}
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button 
              size="lg" 
              className="btn-primary-bold h-14 rounded-full px-10 text-base font-bold text-white border-0" 
              asChild
            >
              <a href="/login" target="_blank" rel="noopener noreferrer">
                <Sparkles className="mr-2 h-5 w-5" />
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="h-14 rounded-full px-10 text-base font-semibold border-2 hover:bg-primary/5" 
              asChild
            >
              <Link to="/login">
                Watch Demo
              </Link>
            </Button>
          </div>

          {/* AI Status Indicators */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8">
            <div className="flex items-center gap-3 rounded-full bg-card/80 backdrop-blur-sm border border-border px-5 py-3 shadow-soft">
              <AIIndicator variant="dot" status="active" />
              <Brain className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">AI Agents Active</span>
            </div>
            <div className="flex items-center gap-3 rounded-full bg-card/80 backdrop-blur-sm border border-border px-5 py-3 shadow-soft">
              <Lock className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-3 rounded-full bg-card/80 backdrop-blur-sm border border-border px-5 py-3 shadow-soft">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">HIPAA Ready</span>
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-16 grid grid-cols-3 gap-8 border-t border-border/50 pt-12">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <span className="text-4xl font-bold text-foreground">10x</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Faster workflows</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <AIIndicator variant="dot" status="active" size="lg" />
                <span className="text-4xl font-bold text-foreground">24/7</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">AI availability</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-4xl font-bold text-foreground">100%</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Data privacy</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
