/**
 * Agent Execution Viewer Component
 *
 * Displays multi-step agent execution workflows with:
 * - Step-by-step progress
 * - Reasoning traces
 * - Tool execution results
 * - Performance metrics
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  BrainCircuit,
  Zap,
} from "lucide-react";
import { useAgentExecutionPlans, useExecutionSteps, useReasoningTraces } from "@/hooks/useAgentTools";
import { formatDistanceToNow } from "date-fns";

interface AgentExecutionViewerProps {
  agentId: string;
  planId?: string;
  showReasoningTraces?: boolean;
}

export function AgentExecutionViewer({
  agentId,
  planId,
  showReasoningTraces = true,
}: AgentExecutionViewerProps) {
  const { data: plans, isLoading: plansLoading } = useAgentExecutionPlans(agentId);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(planId || null);

  // If planId is provided, use it; otherwise use the first plan
  const activePlanId = planId || selectedPlan || plans?.[0]?.id;
  const { data: steps } = useExecutionSteps(activePlanId || "");
  const { data: traces } = useReasoningTraces(activePlanId || "");

  const activePlan = plans?.find((p) => p.id === activePlanId);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "running":
      case "in_progress":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      running: "secondary",
      failed: "destructive",
      pending: "outline",
      in_progress: "secondary",
    };

    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status}
      </Badge>
    );
  };

  if (plansLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <BrainCircuit className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            No execution history yet. This agent hasn't run any multi-step workflows.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Plan Selection */}
      {!planId && plans.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {plans.map((plan) => (
            <Button
              key={plan.id}
              variant={activePlanId === plan.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPlan(plan.id)}
              className="flex-shrink-0"
            >
              {plan.goal?.slice(0, 40)}...
            </Button>
          ))}
        </div>
      )}

      {/* Active Plan Details */}
      {activePlan && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <CardTitle className="text-lg">{activePlan.goal || "Agent Execution"}</CardTitle>
                <CardDescription>
                  Started {formatDistanceToNow(new Date(activePlan.created_at), { addSuffix: true })}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(activePlan.status)}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {activePlan.total_tokens_used && (
                    <span>{activePlan.total_tokens_used.toLocaleString()} tokens</span>
                  )}
                  {activePlan.total_cost && (
                    <span>${activePlan.total_cost.toFixed(4)}</span>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Execution Steps */}
          <CardContent className="space-y-3">
            {steps && steps.length > 0 ? (
              steps.map((step, index) => (
                <ExecutionStep
                  key={step.id}
                  step={step}
                  stepNumber={index + 1}
                  showReasoningTraces={showReasoningTraces}
                  traces={traces?.filter((t) => t.step_id === step.id)}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No execution steps found
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reasoning Traces (Plan-level) */}
      {showReasoningTraces && traces && traces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BrainCircuit className="h-4 w-4" />
              Agent Reasoning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {traces
                .filter((t) => !t.step_id)
                .map((trace) => (
                  <div
                    key={trace.id}
                    className="text-sm p-3 bg-muted rounded-md"
                  >
                    <p className="font-medium mb-1">{trace.decision_type}</p>
                    <p className="text-muted-foreground">{trace.reasoning}</p>
                    {trace.confidence_score && (
                      <p className="text-xs mt-2 text-muted-foreground">
                        Confidence: {(trace.confidence_score * 100).toFixed(0)}%
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ExecutionStepProps {
  step: any;
  stepNumber: number;
  showReasoningTraces?: boolean;
  traces?: any[];
}

function ExecutionStep({ step, stepNumber, showReasoningTraces, traces }: ExecutionStepProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "running":
      case "in_progress":
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "pending":
        return <Clock className="h-5 w-5 text-gray-400" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-3">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">{getStatusIcon(step.status)}</div>

            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  Step {stepNumber}: {step.tool_name || step.action_type}
                </span>
                {step.can_run_parallel && (
                  <Badge variant="outline" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    Parallel
                  </Badge>
                )}
              </div>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {step.execution_time_ms && (
                <span className="text-xs text-muted-foreground">
                  {step.execution_time_ms}ms
                </span>
              )}
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 pt-3 border-t space-y-3">
          {/* Parameters */}
          {step.parameters && Object.keys(step.parameters).length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">Parameters:</p>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                {JSON.stringify(step.parameters, null, 2)}
              </pre>
            </div>
          )}

          {/* Result */}
          {step.result && (
            <div>
              <p className="text-xs font-medium mb-1">Result:</p>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                {typeof step.result === "string"
                  ? step.result
                  : JSON.stringify(step.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {step.error_message && (
            <div className="bg-red-50 border border-red-200 rounded p-2">
              <p className="text-xs font-medium text-red-900 mb-1">Error:</p>
              <p className="text-xs text-red-700">{step.error_message}</p>
              {step.retry_count > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Retries: {step.retry_count} / {step.max_retries}
                </p>
              )}
            </div>
          )}

          {/* Reasoning Traces for this step */}
          {showReasoningTraces && traces && traces.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2 flex items-center gap-1">
                <BrainCircuit className="h-3 w-3" />
                Reasoning:
              </p>
              <div className="space-y-2">
                {traces.map((trace) => (
                  <div
                    key={trace.id}
                    className="text-xs p-2 bg-blue-50 border border-blue-200 rounded"
                  >
                    <p className="font-medium text-blue-900">{trace.decision_type}</p>
                    <p className="text-blue-700 mt-1">{trace.reasoning}</p>
                    {trace.confidence_score && (
                      <p className="text-blue-600 mt-1">
                        Confidence: {(trace.confidence_score * 100).toFixed(0)}%
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {step.depends_on && step.depends_on.length > 0 && (
            <div>
              <p className="text-xs font-medium">Depends on steps:</p>
              <p className="text-xs text-muted-foreground">
                {step.depends_on.join(", ")}
              </p>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
