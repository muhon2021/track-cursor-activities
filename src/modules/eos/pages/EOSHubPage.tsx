/**
 * EOS Hub Page
 *
 * Main landing page for the EOS module. Shows navigation cards
 * to all EOS sub-features (VTO, OKRs, Issues, Scorecard, Accountability).
 */

import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Target,
  Eye,
  AlertCircle,
  BarChart3,
  Users,
  TrendingUp,
} from "lucide-react";
import { AgentTeamBanner } from "@/components/ai/AgentTeamBanner";
import { AIAgentPresenceIndicator } from "@/components/ai/AIAgentPresenceIndicator";

const features = [
  {
    title: "Vision/Traction Organizer",
    description: "Define your company's vision, core values, and strategic targets",
    icon: Eye,
    href: "/eos/vto",
    color: "text-blue-600 bg-blue-50",
  },
  {
    title: "OKRs",
    description: "Set and track objectives with measurable key results",
    icon: Target,
    href: "/okrs",
    color: "text-purple-600 bg-purple-50",
  },
  {
    title: "Issues",
    description: "Track, prioritize, and resolve organizational issues",
    icon: AlertCircle,
    href: "/eos/issues",
    color: "text-red-600 bg-red-50",
  },
  {
    title: "Scorecard",
    description: "Monitor key metrics and performance indicators",
    icon: BarChart3,
    href: "/eos/scorecard",
    color: "text-green-600 bg-green-50",
  },
  {
    title: "Accountability Chart",
    description: "Visualize organizational structure and responsibilities",
    icon: Users,
    href: "/eos/accountability",
    color: "text-orange-600 bg-orange-50",
  },
  {
    title: "My Accountability",
    description: "View your role, responsibilities, and GWC assessment",
    icon: TrendingUp,
    href: "/eos/my-accountability",
    color: "text-indigo-600 bg-indigo-50",
  },
];

export default function EOSHubPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <AgentTeamBanner team="eos" />
      <div className="flex flex-wrap gap-2">
        <AIAgentPresenceIndicator agentName="EOS Coach" agentSlug="eos-coach" gradientFrom="30 90% 50%" gradientTo="45 95% 55%" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">EOS</h1>
        <p className="text-muted-foreground">
          Entrepreneurial Operating System — strategic planning and execution tools
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature) => (
          <Card
            key={feature.href}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(feature.href)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${feature.color}`}>
                  <feature.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
