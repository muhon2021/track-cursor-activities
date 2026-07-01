import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FolderOpen, FileText } from "lucide-react";
import KnowledgeCategories from "@/pages/admin/KnowledgeCategories";
import KnowledgeFiles from "@/pages/admin/KnowledgeFiles";

export default function KnowledgeContent() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "files" ? "files" : "categories";

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Knowledge Content</h1>
        <p className="text-muted-foreground mt-1">
          Manage knowledge categories and uploaded files
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          next.set("tab", v);
          setParams(next, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="categories" className="gap-2">
            <FolderOpen className="h-4 w-4" /> Categories
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2">
            <FileText className="h-4 w-4" /> Files
          </TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-6">
          <KnowledgeCategories />
        </TabsContent>
        <TabsContent value="files" className="mt-6">
          <KnowledgeFiles />
        </TabsContent>
      </Tabs>
    </div>
  );
}
