import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Database, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function TemplateSeeding() {
  const [seedOptions, setSeedOptions] = useState({
    seedAIAgents: true,
    seedKnowledgeCategories: true,
    seedSampleData: false,
  });
  const [isSeeding, setIsSeeding] = useState(false);

  async function handleSeedData() {
    setIsSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-template-data", {
        body: { options: seedOptions },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Successfully seeded: ${data.seeded.join(", ")}`);
        if (data.errors?.length > 0) {
          toast.warning(`Errors: ${data.errors.join(", ")}`);
        }
      } else {
        toast.error("Failed to seed template data");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to seed template data");
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Template Seeding</h1>
        <p className="text-muted-foreground">
          Populate the platform with default templates and sample data
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Template Data Seeding</CardTitle>
          </div>
          <CardDescription>
            Choose which datasets to install. Existing records are not overwritten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="seedAIAgents"
                checked={seedOptions.seedAIAgents}
                onCheckedChange={(checked) =>
                  setSeedOptions({ ...seedOptions, seedAIAgents: checked as boolean })
                }
              />
              <label htmlFor="seedAIAgents" className="text-sm font-medium leading-none">
                Seed Default AI Agents (Meeting Summarizer, Document Analyzer, etc.)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="seedKnowledgeCategories"
                checked={seedOptions.seedKnowledgeCategories}
                onCheckedChange={(checked) =>
                  setSeedOptions({ ...seedOptions, seedKnowledgeCategories: checked as boolean })
                }
              />
              <label htmlFor="seedKnowledgeCategories" className="text-sm font-medium leading-none">
                Seed Knowledge Base Categories
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="seedSampleData"
                checked={seedOptions.seedSampleData}
                onCheckedChange={(checked) =>
                  setSeedOptions({ ...seedOptions, seedSampleData: checked as boolean })
                }
              />
              <label htmlFor="seedSampleData" className="text-sm font-medium leading-none">
                Seed Sample Data (demo clients, meetings, etc.)
              </label>
            </div>
          </div>

          <Button onClick={handleSeedData} disabled={isSeeding} variant="outline" className="w-full">
            {isSeeding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Seeding Data...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Seed Template Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
