import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

const colors: Record<string, string> = {
  trigger: "border-blue-500 bg-blue-500/10",
  condition: "border-amber-500 bg-amber-500/10",
  action: "border-green-500 bg-green-500/10",
  delay: "border-purple-500 bg-purple-500/10",
  approval: "border-orange-500 bg-orange-500/10",
  loop: "border-cyan-500 bg-cyan-500/10",
  branch: "border-pink-500 bg-pink-500/10",
};

function BaseNode({ data, type }: NodeProps & { type: string }) {
  const label = (data?.label as string) ?? type;
  return (
    <div className={cn("rounded-lg border-2 px-4 py-2 min-w-[140px] shadow-sm", colors[type] ?? "border-border")}>
      {type !== "trigger" && <Handle type="target" position={Position.Top} className="!bg-primary" />}
      <div className="text-xs font-medium uppercase text-muted-foreground">{type}</div>
      <div className="text-sm font-semibold truncate">{label}</div>
      {type !== "action" && type !== "delay" && <Handle type="source" position={Position.Bottom} className="!bg-primary" />}
      {(type === "action" || type === "delay") && <Handle type="source" position={Position.Bottom} className="!bg-primary" />}
    </div>
  );
}

export const TriggerNode = memo((props: NodeProps) => <BaseNode {...props} type="trigger" />);
export const ConditionNode = memo((props: NodeProps) => <BaseNode {...props} type="condition" />);
export const ActionNode = memo((props: NodeProps) => <BaseNode {...props} type="action" />);
export const DelayNode = memo((props: NodeProps) => <BaseNode {...props} type="delay" />);
export const ApprovalNode = memo((props: NodeProps) => <BaseNode {...props} type="approval" />);
export const LoopNode = memo((props: NodeProps) => <BaseNode {...props} type="loop" />);
export const BranchNode = memo((props: NodeProps) => <BaseNode {...props} type="branch" />);

TriggerNode.displayName = "TriggerNode";
ConditionNode.displayName = "ConditionNode";
ActionNode.displayName = "ActionNode";
DelayNode.displayName = "DelayNode";
ApprovalNode.displayName = "ApprovalNode";
LoopNode.displayName = "LoopNode";
BranchNode.displayName = "BranchNode";

export const nodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  approval: ApprovalNode,
  loop: LoopNode,
  branch: BranchNode,
};
