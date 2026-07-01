import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Zap, Layout, FileText, Rocket } from "lucide-react";

export default function Help() {
  const sections = [
    {
      title: "Getting Started",
      description: "Setup, environment variables, and quickstart guides",
      icon: Rocket,
    },
    {
      title: "Architecture",
      description: "System design, data flow, and security overview",
      icon: Layout,
    },
    {
      title: "Module Guides",
      description: "Feature documentation for meetings, knowledge, EOS, and more",
      icon: BookOpen,
    },
    {
      title: "Integrations",
      description: "Zoom, Google, Microsoft Teams, and OAuth setup",
      icon: Zap,
    },
    {
      title: "Development",
      description: "Release workflow, testing, and deployment guides",
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help & Guides</h1>
        <p className="text-muted-foreground">
          Documentation and guides for using the Control Tower platform
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
