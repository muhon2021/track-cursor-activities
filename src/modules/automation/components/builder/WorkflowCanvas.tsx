import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./WorkflowNodes";
import { NodePalette } from "./NodePalette";
import { NodeConfigPanel } from "./NodeConfigPanel";
import type { AutomationStepType, WorkflowDefinition } from "../../types";
import { definitionToFlow, flowToDefinition } from "../../lib/workflowValidator";

interface WorkflowCanvasProps {
  definition: WorkflowDefinition;
  triggerType: string;
  onDefinitionChange: (def: WorkflowDefinition, triggerType: string) => void;
}

let nodeCounter = 0;

export function WorkflowCanvas({ definition, triggerType, onDefinitionChange }: WorkflowCanvasProps) {
  const initial = useMemo(() => definitionToFlow(definition), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  const selectedNode = nodes.find((n) => n.selected) ?? null;

  const sync = useCallback(
    (nextNodes: Node[], nextEdges: typeof edges, tt: string) => {
      const def = flowToDefinition(
        nextNodes.map((n) => ({
          id: n.id,
          type: n.type,
          data: n.data as { config?: Record<string, unknown> },
        })),
        nextEdges.map((e) => ({ source: e.source, target: e.target, label: e.label as string | undefined })),
        tt
      );
      onDefinitionChange(def, tt);
    },
    [onDefinitionChange]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge(connection, eds);
        sync(nodes, next, triggerType);
        return next;
      });
    },
    [nodes, setEdges, sync, triggerType]
  );

  const onAddNode = (type: AutomationStepType) => {
    nodeCounter += 1;
    const id = `${type}-${nodeCounter}`;
    const newNode: Node = {
      id,
      type,
      position: { x: 250, y: nodes.length * 100 + 80 },
      data: {
        label: type === "action" ? "send notification" : id,
        config: type === "action" ? { action: "send_notification" } : {},
      },
    };
    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    sync(nextNodes, edges, triggerType);
  };

  const onUpdateNode = (nodeId: string, config: Record<string, unknown>, label?: string) => {
    const nextNodes = nodes.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, config, label: label ?? n.data.label } }
        : n
    );
    setNodes(nextNodes);
    sync(nextNodes, edges, triggerType);
  };

  const onTriggerTypeChange = (tt: string) => {
    onDefinitionChange(flowToDefinition(
      nodes.map((n) => ({ id: n.id, type: n.type, data: n.data as { config?: Record<string, unknown> } })),
      edges.map((e) => ({ source: e.source, target: e.target, label: e.label as string | undefined })),
      tt
    ), tt);
  };

  return (
    <div className="flex gap-4 h-[600px]">
      <NodePalette onAdd={onAddNode} />
      <div className="flex-1 border rounded-lg overflow-hidden bg-muted/20">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => {
            onNodesChange(changes);
            setTimeout(() => sync(nodes, edges, triggerType), 0);
          }}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          onSelectionChange={({ nodes: sel }) => {
            void sel;
          }}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      <NodeConfigPanel
        selectedNode={selectedNode}
        triggerType={triggerType}
        onTriggerTypeChange={onTriggerTypeChange}
        onUpdateNode={onUpdateNode}
      />
    </div>
  );
}
