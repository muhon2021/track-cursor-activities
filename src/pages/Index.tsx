import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, Menu } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";
import { AIIndicator } from "@/components/ui/ai-indicator";
import { useState } from "react";

import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSolution } from "@/components/landing/ProblemSolution";
import { ValueProps } from "@/components/landing/ValueProps";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { AITeamShowcase } from "@/components/landing/AITeamShowcase";
import { SocialProof } from "@/components/landing/SocialProof";
import { PricingPreview } from "@/components/landing/PricingPreview";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export default function Index() {
  const { companyName, logoUrl } = useBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Bold, clean with AI indicator */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Logo with AI Indicator */}
          <Link to="/" className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl ai-gradient shadow-ai">
                <Brain className="h-5 w-5 text-white" />
                <div className="absolute -top-0.5 -right-0.5">
                  <AIIndicator variant="dot" size="sm" />
                </div>
              </div>
            )}
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-foreground">{companyName}</span>
              <span className="text-sm font-semibold text-primary">Control Tower</span>
            </div>
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden items-center gap-8 lg:flex">
            <Link to="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Features
            </Link>
            <Link to="#industries" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Industries
            </Link>
            <Link to="/pricing" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </Link>
            <a
              href="/login"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Resources
            </a>
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="hidden sm:flex font-medium" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button 
              size="sm" 
              className="btn-primary-bold rounded-full px-5 font-semibold text-white border-0 hidden sm:flex"
              asChild
            >
              <a href="/login" target="_blank" rel="noopener noreferrer">
                <Sparkles className="mr-1.5 h-4 w-4" />
                Get Started
              </a>
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-border lg:hidden">
            <nav className="flex flex-col gap-2 p-4">
              <Link 
                to="#features" 
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link 
                to="#industries" 
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Industries
              </Link>
              <Link 
                to="/pricing" 
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link 
                to="/login" 
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign in
              </Link>
              <Button 
                size="sm" 
                className="btn-primary-bold mt-2 rounded-full font-semibold text-white border-0"
                asChild
              >
                <a href="/login" target="_blank" rel="noopener noreferrer">
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Get Started
                </a>
              </Button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        <HeroSection />
        <ProblemSolution />
        <ValueProps />
        <FeatureGrid />
        <AITeamShowcase />
        <SocialProof />
        <PricingPreview />
        <FinalCTA />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
