/**
 * Agent Detail Page — /agents/:slug
 *
 * Rich detail page for each AI agent with gradient hero,
 * capabilities, how-to-use instructions, and navigation.
 */

import { useParams, useNavigate, Link } from "react-router-dom";
import { icons, Sparkles, ArrowLeft, ArrowRight, MapPin, Zap, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { findAgentBySlug } from "@/components/ai/agentTeamConfig";
import { useAIAgents } from "@/hooks/useAIAgents";
import { cn } from "@/lib/utils";

export default function AgentDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: dbAgents = [] } = useAIAgents();

  // Try static config first, then DB
  const staticMatch = slug ? findAgentBySlug(slug) : undefined;
  const dbAgent = dbAgents.find((a) => a.slug === slug);

  if (!staticMatch && !dbAgent) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Sparkles className="h-12 w-12 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold text-foreground">Agent not found</h2>
        <Button variant="outline" onClick={() => navigate("/agents")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Agents
        </Button>
      </div>
    );
  }

  const agent = staticMatch?.agent;
  const team = staticMatch?.team;
  const agentName = agent?.name || dbAgent?.name || "AI Agent";
  const agentDesc = agent?.description || dbAgent?.description || "An AI-powered assistant ready to help.";
  const iconName = agent?.icon || "Bot";
  const IconComponent = icons[iconName as keyof typeof icons] || icons["Bot"];
  const gradientFrom = team?.gradientFrom || "199 89% 48%";
  const gradientTo = team?.gradientTo || "187 100% 42%";
  const capabilities = agent?.capabilities || [];
  const howToUse = agent?.howToUse || [];
  const whereToFind = agent?.whereToFind;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/agents")} className="text-muted-foreground -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> All Agents
      </Button>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden shadow-lg">
        {/* Gradient banner */}
        <div
          className="h-36 sm:h-44 relative"
          style={{
            background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
          }}
        >
          {/* Decorative shapes */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-20 bg-white" />
            <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full opacity-10 bg-white" />
          </div>
        </div>

        {/* Icon + info overlay */}
        <div className="relative bg-card px-6 sm:px-8 pb-6 pt-0">
          {/* Icon circle */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-background -mt-10 relative z-10"
            style={{
              background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
            }}
          >
            {IconComponent && <IconComponent className="h-9 w-9 text-white" />}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground">{agentName}</h1>
              {team && (
                <Badge variant="secondary" className="mt-2 text-xs font-medium">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Part of {team.name}
                </Badge>
              )}
              <p className="text-muted-foreground mt-3 text-base leading-relaxed max-w-xl">
                {agentDesc}
              </p>
            </div>

            {/* CTA sidebar for desktop */}
            {whereToFind && (
              <div className="hidden sm:block flex-shrink-0">
                <Button
                  size="lg"
                  className="font-semibold text-white shadow-lg hover:shadow-xl transition-all"
                  style={{
                    background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
                  }}
                  onClick={() => navigate(whereToFind.path)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" /> Go to {whereToFind.label}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile CTA */}
      {whereToFind && (
        <div className="sm:hidden">
          <Button
            size="lg"
            className="w-full font-semibold text-white shadow-lg"
            style={{
              background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
            }}
            onClick={() => navigate(whereToFind.path)}
          >
            <ExternalLink className="h-4 w-4 mr-2" /> Go to {whereToFind.label}
          </Button>
        </div>
      )}

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <Accordion type="multiple" defaultValue={["capabilities", "how-to-use", "where"]} className="space-y-3">
            {/* Capabilities */}
            {capabilities.length > 0 && (
              <AccordionItem value="capabilities" className="border rounded-xl px-5 bg-card shadow-sm">
                <AccordionTrigger className="text-base font-semibold hover:no-underline py-4">
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" /> What this agent does
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <ul className="space-y-3">
                    {capabilities.map((cap, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold mt-0.5"
                          style={{
                            background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
                          }}
                        >
                          {i + 1}
                        </div>
                        <span className="leading-relaxed">{cap}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* How to use */}
            {howToUse.length > 0 && (
              <AccordionItem value="how-to-use" className="border rounded-xl px-5 bg-card shadow-sm">
                <AccordionTrigger className="text-base font-semibold hover:no-underline py-4">
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" /> How to use it
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <ol className="space-y-3">
                    {howToUse.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-muted text-foreground text-xs font-bold mt-0.5">
                          {i + 1}
                        </div>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Where to find */}
            {whereToFind && (
              <AccordionItem value="where" className="border rounded-xl px-5 bg-card shadow-sm">
                <AccordionTrigger className="text-base font-semibold hover:no-underline py-4">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" /> Where to find it
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <p className="text-sm text-muted-foreground mb-3">
                    This agent is available in the <strong>{whereToFind.label}</strong> section of the app.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <Link to={whereToFind.path}>
                      Go to {whereToFind.label} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Agent info card */}
          <Card className="shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Built by</p>
                <p className="text-sm font-semibold text-foreground">Control Tower</p>
              </div>

              {team && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Team</p>
                  <Link
                    to={`/agents#team-${team.id}`}
                    className="text-sm font-semibold text-primary hover:underline flex items-center gap-1.5"
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
                      }}
                    >
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    {team.name}
                  </Link>
                </div>
              )}

              {team && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Category</p>
                  <Badge variant="secondary" className="text-xs">{team.id}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Other agents in team */}
          {team && team.agents.length > 1 && (
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Other agents in this team
                </p>
                <div className="space-y-2">
                  {team.agents
                    .filter((a) => a.slug !== slug)
                    .map((a) => {
                      const AIcon = icons[a.icon as keyof typeof icons] || icons["Bot"];
                      return (
                        <Link
                          key={a.slug}
                          to={`/agents/${a.slug}`}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted transition-colors text-sm"
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: `linear-gradient(135deg, hsl(${gradientFrom} / 0.15), hsl(${gradientTo} / 0.15))`,
                            }}
                          >
                            {AIcon && <AIcon className="h-3.5 w-3.5 text-foreground" />}
                          </div>
                          <span className="font-medium text-foreground">{a.name}</span>
                        </Link>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
