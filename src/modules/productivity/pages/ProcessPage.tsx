/**
 * Process Documentation Page
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, FolderOpen, Loader2, Pencil, Plus, Tag } from "lucide-react";
import { useProcessCategories, useProcessDocuments, useProcessDocument } from "../hooks/useProcesses";

export default function ProcessPage() {
  const { category, slug } = useParams<{ category?: string; slug?: string }>();
  const navigate = useNavigate();

  // Single document view
  if (category && slug) return <ProcessDocumentView category={category} slug={slug} />;

  // Category listing
  if (category) return <ProcessCategoryView category={category} />;

  // Index view
  return <ProcessIndexView />;
}

function ProcessIndexView() {
  const navigate = useNavigate();
  const { data: categories = [], isLoading } = useProcessCategories();

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Process Documentation</h1>
          <p className="text-muted-foreground">Standard operating procedures and process docs</p>
        </div>
        <Button onClick={() => navigate("/process/new")}>
          <Plus className="h-4 w-4 mr-2" />New Document
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No process categories</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Card key={cat.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/process/${cat.slug}`)}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{cat.name}</h3>
                    {cat.description && <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>}
                  </div>
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Badge variant="secondary">
                    <FileText className="h-3 w-3 mr-1" />
                    {cat.document_count || 0} docs
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ProcessCategoryView({ category }: { category: string }) {
  const navigate = useNavigate();
  const { data: documents = [], isLoading } = useProcessDocuments(category);
  const { data: categories = [] } = useProcessCategories();
  const currentCategory = categories.find((c) => c.slug === category);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/process")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{currentCategory?.name || category}</h1>
          {currentCategory?.description && <p className="text-muted-foreground">{currentCategory.description}</p>}
        </div>
        <Button onClick={() => navigate(`/process/${category}/new`)}>
          <Plus className="h-4 w-4 mr-2" />New Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No documents in this category</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate(`/process/${category}/${doc.slug}`)}>
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {doc.author && <span className="text-xs text-muted-foreground">{doc.author.full_name}</span>}
                    {doc.published_at && <span className="text-xs text-muted-foreground">· {new Date(doc.published_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {doc.tags?.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs"><Tag className="h-2.5 w-2.5 mr-0.5" />{tag}</Badge>
                  ))}
                </div>
                <Badge variant="outline">v{doc.version}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ProcessDocumentView({ category, slug }: { category: string; slug: string }) {
  const navigate = useNavigate();
  const { data: doc, isLoading } = useProcessDocument(category, slug);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">Document not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/process/${category}`)}>Back to Category</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/process/${category}`)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{doc.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            {doc.category && <Badge variant="secondary">{doc.category.name}</Badge>}
            <Badge variant="outline">v{doc.version}</Badge>
            {doc.author && <span className="text-sm text-muted-foreground">by {doc.author.full_name}</span>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/process/${category}/${slug}/edit`)}>
          <Pencil className="h-4 w-4 mr-1" />Edit
        </Button>
      </div>

      <Card>
        <CardContent className="py-6">
          {doc.content ? (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">{doc.content}</div>
          ) : (
            <p className="text-muted-foreground">No content available.</p>
          )}
        </CardContent>
      </Card>

      {doc.tags && doc.tags.length > 0 && (
        <div className="flex items-center gap-2">
          {doc.tags.map((tag) => (
            <Badge key={tag} variant="secondary"><Tag className="h-3 w-3 mr-1" />{tag}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
