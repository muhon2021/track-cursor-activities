/**
 * Chart Form Component
 *
 * Form for creating or editing an accountability chart.
 * Pre-fills fields when a chart is provided (edit mode).
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { AccountabilityChart } from "../../types";

interface ChartFormProps {
  chart?: AccountabilityChart;
  onSubmit: (data: { name: string; description?: string }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ChartForm({ chart, onSubmit, onCancel, isSubmitting = false }: ChartFormProps) {
  const [name, setName] = useState(chart?.name ?? "");
  const [description, setDescription] = useState(chart?.description ?? "");

  const isEditing = !!chart;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Chart" : "Create Chart"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chart-name">Name</Label>
            <Input
              id="chart-name"
              placeholder="Accountability chart name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chart-description">Description</Label>
            <Textarea
              id="chart-description"
              placeholder="Optional description for this chart"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Chart"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
