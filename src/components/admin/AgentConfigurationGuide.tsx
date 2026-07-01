/**
 * Agent Configuration Guide Component
 *
 * Provides clear direction and guidance when configuring agents in the admin panel.
 * Includes tooltips, examples, and best practices for each feature.
 */

import { Info, HelpCircle, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface FeatureGuideProps {
  title: string;
  description: string;
  when: string;
  whenNot: string;
  example?: string;
  docs?: string;
}

/**
 * Feature Guide Tooltip
 * Shows when to use a feature and when not to
 */
export function FeatureGuideTooltip({ title, description, when, whenNot, example, docs }: FeatureGuideProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-md p-4">
          <div className="space-y-2">
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">When to use:</p>
                  <p className="text-xs text-muted-foreground">{when}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">When NOT to use:</p>
                  <p className="text-xs text-muted-foreground">{whenNot}</p>
                </div>
              </div>
            </div>

            {example && (
              <div className="bg-muted p-2 rounded text-xs">
                <p className="font-medium mb-1">Example:</p>
                <p className="text-muted-foreground">{example}</p>
              </div>
            )}

            {docs && (
              <a
                href={docs}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-info hover:underline inline-flex items-center gap-1"
              >
                Learn more →
              </a>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Memory System Guide
 */
export function MemorySystemGuide() {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <label className="text-sm font-medium flex items-center gap-2">
          Memory Enabled
          <FeatureGuideTooltip
            title="Agent Memory System"
            description="Enables agents to remember conversations, learn preferences, and provide context-aware responses"
            when="User has repeat interactions, needs personalization, or requires context across sessions"
            whenNot="One-time queries, privacy-sensitive data, or cost-critical scenarios"
            example="Customer support agent remembers previous tickets and user preferences"
            docs="/docs/AGENTIC_FEATURES_GUIDE.md#agent-memory-system"
          />
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          Agent will remember past conversations and user preferences
        </p>
      </div>
    </div>
  );
}

/**
 * Tool Orchestration Guide
 */
export function ToolOrchestrationGuide() {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <label className="text-sm font-medium flex items-center gap-2">
          Tool Orchestration (MCP)
          <FeatureGuideTooltip
            title="Tool Orchestration"
            description="Allows agents to use external tools and execute multi-step workflows"
            when="Agent needs to perform actions (create tasks, send emails, search databases)"
            whenNot="Simple Q&A, read-only information retrieval, or chat-only scenarios"
            example="Project manager agent creates tasks, schedules meetings, and updates status"
            docs="/docs/AGENTIC_FEATURES_GUIDE.md#tool-orchestration"
          />
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          Agent can execute tools and multi-step workflows
        </p>
      </div>
    </div>
  );
}

/**
 * Multi-Agent Collaboration Guide
 */
export function MultiAgentCollaborationInfo() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Multi-Agent Collaboration</AlertTitle>
      <AlertDescription className="space-y-2 text-sm">
        <p>
          This agent can work with other agents in teams. Choose a collaboration strategy:
        </p>

        <div className="space-y-2">
          <div>
            <Badge variant="outline" className="mr-2">Sequential</Badge>
            <span className="text-xs">Assembly line (Agent 1 → Agent 2 → Agent 3)</span>
          </div>
          <div>
            <Badge variant="outline" className="mr-2">Parallel</Badge>
            <span className="text-xs">Multiple agents work simultaneously</span>
          </div>
          <div>
            <Badge variant="outline" className="mr-2">Hierarchical</Badge>
            <span className="text-xs">Coordinator delegates to specialists</span>
          </div>
          <div>
            <Badge variant="outline" className="mr-2">Consensus</Badge>
            <span className="text-xs">Agents discuss and reach agreement</span>
          </div>
        </div>

        <a
          href="/docs/MULTI_AGENT_TUTORIAL.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-info hover:underline inline-block mt-2"
        >
          Read Multi-Agent Tutorial →
        </a>
      </AlertDescription>
    </Alert>
  );
}

/**
 * HITL Approval Guide
 */
export function HITLApprovalInfo() {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Human-in-the-Loop Approvals</AlertTitle>
      <AlertDescription className="space-y-2 text-sm">
        <p>
          Require human approval for critical agent actions. Set up approval workflows for:
        </p>

        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>High-cost operations ($10+, $100+, etc.)</li>
          <li>Data modifications or deletions</li>
          <li>External communications (emails, social media)</li>
          <li>Low-confidence decisions (&lt;70% confidence)</li>
        </ul>

        <div className="bg-info/10 border border-info/30 rounded p-2 mt-2">
          <p className="text-xs font-medium text-info">Pro Tip:</p>
          <p className="text-xs text-info">
            Start with strict approvals (require approval for everything), then relax as you build trust.
          </p>
        </div>

        <a
          href="/docs/HITL_SETUP_GUIDE.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-info hover:underline inline-block mt-2"
        >
          Read HITL Setup Guide →
        </a>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Agent Category Guide
 */
export function AgentCategoryGuide() {
  const categories = [
    {
      name: "Customer Support",
      description: "Handle customer queries, tickets, and support escalation",
      examples: "FAQ bot, Technical support, Billing assistance",
      bestFor: "Sequential teams (L1 → L2 → L3)",
    },
    {
      name: "Content Creation",
      description: "Generate, edit, and optimize content",
      examples: "Blog writer, Social media, SEO optimizer",
      bestFor: "Parallel teams (research + writing + SEO)",
    },
    {
      name: "Project Management",
      description: "Plan, coordinate, and track projects",
      examples: "Task delegation, Timeline management, Resource allocation",
      bestFor: "Hierarchical teams (PM coordinates specialists)",
    },
    {
      name: "Code Review",
      description: "Review code for quality, security, and performance",
      examples: "Security check, Performance audit, Style guide",
      bestFor: "Consensus teams (multiple perspectives)",
    },
    {
      name: "Research & Analysis",
      description: "Gather information and provide insights",
      examples: "Market research, Competitive analysis, Data synthesis",
      bestFor: "Parallel teams (analyze multiple sources)",
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Choose the right category for your agent:</p>

      {categories.map((category) => (
        <Card key={category.name} className="border-l-4 border-l-blue-500">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{category.name}</CardTitle>
            <CardDescription className="text-xs">{category.description}</CardDescription>
          </CardHeader>
          <CardContent className="py-2 pt-0 text-xs space-y-1">
            <div>
              <span className="font-medium">Examples:</span> {category.examples}
            </div>
            <div>
              <span className="font-medium">Best for:</span> {category.bestFor}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * System Prompt Guide
 */
export function SystemPromptGuide() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">System Prompt</label>
        <FeatureGuideTooltip
          title="System Prompt"
          description="Instructions that define the agent's behavior, expertise, and response style"
          when="Always! This is the agent's core personality and capabilities"
          whenNot="Never skip this - it's required for agent functionality"
          example="You are an expert customer support agent. Focus on: empathy, clear solutions, escalation when needed."
          docs="/docs/AGENT_BEST_PRACTICES.md#system-prompts"
        />
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs space-y-2">
          <p className="font-medium">Best Practices:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Be specific about the agent's role and expertise</li>
            <li>Define response format (bullet points, paragraphs, etc.)</li>
            <li>Set tone and communication style</li>
            <li>Include constraints (what NOT to do)</li>
            <li>Add examples if behavior is complex</li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="bg-muted p-3 rounded text-xs space-y-2">
        <p className="font-medium">Example Templates:</p>

        <div>
          <p className="font-medium text-success">✓ Good:</p>
          <code className="block bg-background p-2 rounded mt-1">
            You are an expert UI/UX designer. Focus on:
            <br />- User-centered design principles
            <br />- Modern design trends (minimalism, bold typography)
            <br />- Accessibility (WCAG 2.1 AA compliance)
            <br />- Mobile-first responsive design
            <br /><br />
            Provide specific, actionable feedback with examples.
            <br />Always consider user experience impact.
          </code>
        </div>

        <div>
          <p className="font-medium text-destructive">✗ Bad:</p>
          <code className="block bg-background p-2 rounded mt-1">
            You are a helpful assistant.
          </code>
          <p className="text-muted-foreground mt-1">Too vague - no specific expertise or guidance</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Feature Comparison Card
 */
export function FeatureComparisonCard() {
  const features = [
    {
      name: "Memory",
      enabled: "Remembers context, learns preferences, personalizes responses",
      disabled: "Fresh start every conversation, no context retention",
      cost: "Low (storage costs only)",
    },
    {
      name: "Tools (MCP)",
      enabled: "Can execute actions, use external tools, automate workflows",
      disabled: "Chat-only, no ability to take actions",
      cost: "Variable (depends on tool usage)",
    },
    {
      name: "Multi-Agent",
      enabled: "Collaborate with other agents, delegate tasks, peer review",
      disabled: "Works alone, handles everything independently",
      cost: "Higher (multiple agent calls)",
    },
    {
      name: "HITL Approvals",
      enabled: "Human review for critical actions, safety guardrails",
      disabled: "Agent acts autonomously, no human checkpoints",
      cost: "None (just adds latency)",
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Feature Impact Comparison:</p>

      {features.map((feature) => (
        <Card key={feature.name}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              {feature.name}
              <Badge variant="outline" className="text-xs">
                Cost: {feature.cost}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 pt-0 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Enabled:</p>
                <p className="text-muted-foreground">{feature.enabled}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Disabled:</p>
                <p className="text-muted-foreground">{feature.disabled}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Quick Start Wizard
 */
export function QuickStartWizard() {
  return (
    <Card className="border-2 border-info">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5 text-info" />
          Quick Start Guide
        </CardTitle>
        <CardDescription>
          Follow these steps to create your first AI agent
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-info text-primary-foreground text-xs font-bold flex-shrink-0">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Choose a category</p>
              <p className="text-xs text-muted-foreground">
                Select what this agent will do (Support, Content, Projects, etc.)
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-info text-primary-foreground text-xs font-bold flex-shrink-0">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Write a clear system prompt</p>
              <p className="text-xs text-muted-foreground">
                Define the agent's expertise, tone, and behavior
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-info text-primary-foreground text-xs font-bold flex-shrink-0">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Enable features</p>
              <p className="text-xs text-muted-foreground">
                Memory (personalization), Tools (actions), Teams (collaboration)
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-info text-primary-foreground text-xs font-bold flex-shrink-0">
              4
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Set up approval workflows (optional)</p>
              <p className="text-xs text-muted-foreground">
                Add human checkpoints for critical actions
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-info text-primary-foreground text-xs font-bold flex-shrink-0">
              5
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Test and iterate</p>
              <p className="text-xs text-muted-foreground">
                Try the agent, review performance, adjust prompts
              </p>
            </div>
          </div>
        </div>

        <Alert className="bg-success/10 border-success/30">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertDescription className="text-xs text-success">
            <span className="font-medium">Pro Tip:</span> Start simple! Enable one feature at a time
            and test thoroughly before adding more complexity.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
