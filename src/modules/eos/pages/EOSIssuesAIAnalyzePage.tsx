/**
 * EOS Issues AI Analyze Page
 *
 * Multi-step wizard for AI-powered issue analysis. Users select data sources,
 * run a simulated AI analysis, and review extracted issues with accept/dismiss
 * actions before creating them in the EOS issues tracker.
 *
 * Steps:
 *  1. Select data sources (transcripts, project issues, manual input) and optional pod scope
 *  2. Animated analysis progress (simulated)
 *  3. Review extracted issues with confidence scores, accept or dismiss each
 *
 * Route: /eos/issues/ai-analyze
 * @module eos/pages
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  FileText,
  AlertCircle,
  PenLine,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useEOSPods } from "../hooks/useEOSPods";
import type { IssueCategory, IssuePriority } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtractedIssue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
  confidence: number;
  source_hint: string;
}

type WizardStep = 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANALYSIS_STATUSES = [
  "Scanning transcripts...",
  "Identifying patterns...",
  "Extracting issues...",
  "Calculating confidence...",
];

const CATEGORY_COLORS: Record<IssueCategory, string> = {
  people: "bg-blue-100 text-blue-800",
  process: "bg-purple-100 text-purple-800",
  system: "bg-orange-100 text-orange-800",
  external: "bg-teal-100 text-teal-800",
};

const PRIORITY_COLORS: Record<IssuePriority, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const MOCK_EXTRACTED_ISSUES: ExtractedIssue[] = [
  {
    id: "ai-1",
    title: "Recurring deployment failures in CI pipeline",
    description:
      "Multiple team members mentioned deployment issues during standup. The CI pipeline has failed 4 times in the last week due to flaky integration tests, causing delays in feature delivery.",
    category: "system",
    priority: "high",
    confidence: 0.92,
    source_hint: "Identified in weekly standup transcript (Jan 28)",
  },
  {
    id: "ai-2",
    title: "Unclear ownership of cross-pod documentation",
    description:
      "Documentation responsibilities are not well-defined between pods. Several project handoffs have been delayed because documentation was incomplete or missing context.",
    category: "process",
    priority: "medium",
    confidence: 0.78,
    source_hint: "Pattern detected across 3 meeting transcripts",
  },
  {
    id: "ai-3",
    title: "Client onboarding bottleneck in sales-to-delivery handoff",
    description:
      "New client onboarding is taking 2x longer than target due to information gaps between the sales team and delivery pods. Key requirements are being lost in transition.",
    category: "process",
    priority: "critical",
    confidence: 0.85,
    source_hint: "Identified in quarterly review transcript",
  },
  {
    id: "ai-4",
    title: "Team capacity concerns for Q2 commitments",
    description:
      "Current velocity data suggests the team is over-committed for Q2 based on existing rock assignments. Two key engineers have flagged bandwidth concerns.",
    category: "people",
    priority: "high",
    confidence: 0.71,
    source_hint: "Extracted from open project issues and capacity data",
  },
  {
    id: "ai-5",
    title: "Vendor API rate limiting impacting data sync reliability",
    description:
      "External vendor API rate limits are causing intermittent data sync failures. The issue has been mentioned in 2 separate incident reviews this month.",
    category: "external",
    priority: "medium",
    confidence: 0.65,
    source_hint: "Identified in incident review meeting transcript",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EOSIssuesAIAnalyzePage() {
  const navigate = useNavigate();
  const { data: pods } = useEOSPods();

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1: Source selection
  const [useTranscripts, setUseTranscripts] = useState(true);
  const [useProjectIssues, setUseProjectIssues] = useState(false);
  const [useManualInput, setUseManualInput] = useState(false);
  const [manualText, setManualText] = useState("");
  const [selectedPodId, setSelectedPodId] = useState<string>("");

  // Step 2: Analysis progress
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  // Step 3: Results
  const [extractedIssues, setExtractedIssues] = useState<ExtractedIssue[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Whether at least one source is selected
  const hasSourceSelected = useTranscripts || useProjectIssues || useManualInput;

  // ---------------------------------------------------------------------------
  // Step 2: Simulated analysis effect
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (step !== 2) return;

    setProgress(0);
    setStatusIndex(0);

    const totalDuration = 3000;
    const interval = 50;
    const steps = totalDuration / interval;
    let current = 0;

    const timer = setInterval(() => {
      current += 1;
      const pct = Math.min(Math.round((current / steps) * 100), 100);
      setProgress(pct);

      // Cycle through status messages
      const statusIdx = Math.min(
        Math.floor((pct / 100) * ANALYSIS_STATUSES.length),
        ANALYSIS_STATUSES.length - 1,
      );
      setStatusIndex(statusIdx);

      if (pct >= 100) {
        clearInterval(timer);
        // Set mock results and advance to step 3
        setExtractedIssues(MOCK_EXTRACTED_ISSUES);
        setTimeout(() => setStep(3), 400);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [step]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRunAnalysis = useCallback(() => {
    setAcceptedIds(new Set());
    setDismissedIds(new Set());
    setExtractedIssues([]);
    setStep(2);
  }, []);

  const handleAccept = useCallback((id: string) => {
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleCreateIssues = useCallback(() => {
    toast.success(`${acceptedIds.size} issue${acceptedIds.size !== 1 ? "s" : ""} created successfully`);
    navigate("/eos/issues");
  }, [acceptedIds.size, navigate]);

  const handleStartNewAnalysis = useCallback(() => {
    setStep(1);
    setProgress(0);
    setStatusIndex(0);
    setExtractedIssues([]);
    setAcceptedIds(new Set());
    setDismissedIds(new Set());
  }, []);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const visibleIssues = extractedIssues.filter((i) => !dismissedIds.has(i.id));

  // =========================================================================
  // Step 1: Select Sources
  // =========================================================================

  if (step === 1) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">AI Issue Analysis</h1>
              <p className="text-muted-foreground">
                Select data sources and run AI-powered issue extraction
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/eos/issues")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Issues
          </Button>
        </div>

        {/* Source Selection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Data Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Transcripts */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="source-transcripts"
                checked={useTranscripts}
                onCheckedChange={(checked) => setUseTranscripts(checked === true)}
              />
              <div className="space-y-1">
                <label
                  htmlFor="source-transcripts"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  <FileText className="inline h-4 w-4 mr-1.5 text-blue-500" />
                  Recent Meeting Transcripts
                </label>
                <p className="text-xs text-muted-foreground">
                  Analyze transcripts from the last 30 days for recurring themes and blockers
                </p>
              </div>
            </div>

            {/* Project Issues */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="source-project-issues"
                checked={useProjectIssues}
                onCheckedChange={(checked) => setUseProjectIssues(checked === true)}
              />
              <div className="space-y-1">
                <label
                  htmlFor="source-project-issues"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  <AlertCircle className="inline h-4 w-4 mr-1.5 text-orange-500" />
                  Open Project Issues
                </label>
                <p className="text-xs text-muted-foreground">
                  Scan open project-level issues for patterns that should be elevated to EOS
                </p>
              </div>
            </div>

            {/* Manual Input */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="source-manual"
                checked={useManualInput}
                onCheckedChange={(checked) => setUseManualInput(checked === true)}
              />
              <div className="space-y-1">
                <label
                  htmlFor="source-manual"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  <PenLine className="inline h-4 w-4 mr-1.5 text-green-500" />
                  Manual Input
                </label>
                <p className="text-xs text-muted-foreground">
                  Paste or type additional context for the AI to consider
                </p>
              </div>
            </div>

            {useManualInput && (
              <Textarea
                placeholder="Describe challenges, blockers, or themes you've observed..."
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="min-h-[100px]"
              />
            )}

            <Separator />

            {/* Pod Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Scope to Pod <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Select value={selectedPodId} onValueChange={setSelectedPodId}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="All pods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All pods</SelectItem>
                  {pods?.map((pod) => (
                    <SelectItem key={pod.id} value={pod.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: pod.color }}
                        />
                        {pod.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Action */}
        <div className="flex justify-end">
          <Button
            size="lg"
            disabled={!hasSourceSelected}
            onClick={handleRunAnalysis}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Run Analysis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Step 2: Analyzing (Loading State)
  // =========================================================================

  if (step === 2) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">AI Issue Analysis</h1>
            <p className="text-muted-foreground">Analyzing selected data sources...</p>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-6">
            <div className="relative">
              <Brain className="h-12 w-12 text-primary animate-pulse" />
              <Sparkles className="h-5 w-5 text-amber-500 absolute -top-1 -right-1 animate-bounce" />
            </div>

            <div className="w-full max-w-md space-y-3">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {ANALYSIS_STATUSES[statusIndex]}
                </span>
                <span className="font-medium">{progress}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // Step 3: Review Results
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Analysis Results
              <Badge variant="secondary">{extractedIssues.length} found</Badge>
            </h1>
            <p className="text-muted-foreground">
              Review extracted issues and accept or dismiss each one
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {acceptedIds.size > 0 && (
            <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              {acceptedIds.size} accepted
            </Badge>
          )}
        </div>
      </div>

      {/* Issue Cards */}
      <div className="space-y-4">
        {visibleIssues.map((issue) => {
          const isAccepted = acceptedIds.has(issue.id);

          return (
            <Card
              key={issue.id}
              className={isAccepted ? "border-green-300 bg-green-50/30" : ""}
            >
              <CardContent className="pt-5 pb-4 px-5">
                <div className="space-y-3">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-semibold text-base leading-snug">
                      {issue.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant={isAccepted ? "default" : "outline"}
                        className={
                          isAccepted
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "text-green-600 hover:text-green-700 hover:bg-green-50"
                        }
                        onClick={() => handleAccept(issue.id)}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {isAccepted ? "Accepted" : "Accept"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-gray-500 hover:text-gray-700"
                        onClick={() => handleDismiss(issue.id)}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Dismiss
                      </Button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {issue.description}
                  </p>

                  {/* Badges & confidence */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="secondary" className={CATEGORY_COLORS[issue.category]}>
                      {issue.category}
                    </Badge>
                    <Badge variant="secondary" className={PRIORITY_COLORS[issue.priority]}>
                      {issue.priority}
                    </Badge>
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-muted-foreground">Confidence</span>
                      <div className="w-24">
                        <Progress value={issue.confidence * 100} className="h-2" />
                      </div>
                      <span className="text-xs font-medium w-10 text-right">
                        {Math.round(issue.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Source hint */}
                  <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    {issue.source_hint}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer actions */}
      <Separator />
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleStartNewAnalysis}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Start New Analysis
        </Button>
        <Button
          size="lg"
          disabled={acceptedIds.size === 0}
          onClick={handleCreateIssues}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Create {acceptedIds.size} Issue{acceptedIds.size !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}
