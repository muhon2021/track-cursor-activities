import { Link } from "react-router-dom";
import { Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutomationTemplates, useCloneTemplate } from "../hooks/useAutomationTemplates";

export default function TemplatesPage() {
  const { data: templates = [], isLoading } = useAutomationTemplates();
  const clone = useCloneTemplate();

  const grouped = templates.reduce<Record<string, typeof templates>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Template Library</h1>
          <p className="text-muted-foreground">Clone and customize pre-built workflows</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/automation/workflows">Back to Workflows</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="space-y-3">
            <h2 className="text-lg font-semibold capitalize">{category}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <Card key={t.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      {t.is_system && <Badge variant="secondary">System</Badge>}
                    </div>
                    <CardDescription>{t.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline" className="mb-3">{t.trigger_type}</Badge>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => clone.mutate(t.id)}
                      disabled={clone.isPending}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Clone Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
