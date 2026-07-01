import { useParams, Link } from "react-router-dom";
import { useCategoryBySlug } from "../hooks/useKnowledgeAdmin";
import { useKnowledgeEntries, useKnowledgeCategories } from "../hooks/useKnowledge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChevronRight,
  Home,
  Eye,
  FileText,
  FolderTree,
  ArrowLeft,
} from "lucide-react";
import { formatDate, truncateText } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
};

export default function KnowledgeByCategory() {
  const { slug } = useParams<{ slug: string }>();
  const { data: category, isLoading: categoryLoading } = useCategoryBySlug(slug);
  const { data: allCategories = [] } = useKnowledgeCategories();
  const { data: entries = [], isLoading: entriesLoading } = useKnowledgeEntries({
    category_id: category?.id,
  });

  // Get related categories (siblings and children)
  const relatedCategories = allCategories.filter(
    (cat) =>
      cat.id !== category?.id &&
      (cat.parent_id === category?.parent_id ||
        cat.parent_id === category?.id)
  );

  if (categoryLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Loading category...</p>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <FolderTree className="h-16 w-16 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-2xl font-bold">Category not found</h2>
          <p className="text-muted-foreground">
            The category you're looking for doesn't exist
          </p>
        </div>
        <Button asChild>
          <Link to="/knowledge">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Knowledge Base
          </Link>
        </Button>
      </div>
    );
  }

  const colorClass = CATEGORY_COLORS[category.color || "blue"] || "bg-blue-500";
  const publishedCount = entries.filter((e) => e.status === "published").length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/knowledge"
          className="flex items-center gap-1 hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          <span>Knowledge Base</span>
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{category.name}</span>
      </nav>

      {/* Category Header */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 to-background p-8">
        <div className="relative z-10 flex items-start gap-6">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl ${colorClass} text-white shadow-lg`}
          >
            <FolderTree className="h-8 w-8" />
          </div>
          <div className="flex-1 space-y-2">
            <h1 className="text-4xl font-bold">{category.name}</h1>
            {category.description && (
              <p className="text-lg text-muted-foreground">
                {category.description}
              </p>
            )}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-semibold">{publishedCount}</span>
                <span className="text-muted-foreground">
                  {publishedCount === 1 ? "Article" : "Articles"}
                </span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="text-sm text-muted-foreground">
                Updated {formatDate(category.updated_at)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Entries List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Articles in this category</h2>

          {entriesLoading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">Loading articles...</p>
            </div>
          ) : entries.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">
                No articles in this category yet
              </h3>
              <p className="mb-4 text-muted-foreground">
                Be the first to add an article to this category
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/knowledge/new">Add Article</Link>
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <Link key={entry.id} to={`/knowledge/${entry.id}`}>
                  <Card className="transition-all hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <CardTitle className="text-xl">
                            {entry.title}
                          </CardTitle>
                          <CardDescription className="flex flex-wrap items-center gap-2">
                            {entry.status && (
                              <Badge variant="secondary" className="text-xs">
                                {entry.status}
                              </Badge>
                            )}
                            {entry.content && (
                              <span className="text-xs">
                                {Math.ceil(entry.content.split(/\s+/).length / 200)} min read
                              </span>
                            )}
                            {entry.view_count !== null && entry.view_count > 0 && (
                              <span className="flex items-center gap-1 text-xs">
                                <Eye className="h-3 w-3" />
                                {entry.view_count} views
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="line-clamp-3 text-muted-foreground">
                        {truncateText(entry.summary || entry.content, 200)}
                      </p>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {entry.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Published {formatDate(entry.created_at)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Related Categories */}
          {relatedCategories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Related Categories</CardTitle>
                <CardDescription>
                  Explore similar topics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {relatedCategories.slice(0, 5).map((cat) => {
                  const catColorClass =
                    CATEGORY_COLORS[cat.color || "blue"] || "bg-blue-500";
                  const entriesInCat = entries.filter(
                    (e) => e.category_id === cat.id
                  ).length;

                  return (
                    <Link
                      key={cat.id}
                      to={`/knowledge/category/${cat.slug}`}
                      className="flex items-center gap-3 rounded-lg border p-3 transition-all hover:bg-accent"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${catColorClass} text-white`}
                      >
                        <FolderTree className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{cat.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {entriesInCat} {entriesInCat === 1 ? "article" : "articles"}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to="/knowledge/new">
                  <FileText className="mr-2 h-4 w-4" />
                  Add Article
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to="/knowledge">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  All Categories
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Category Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Category Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="font-medium text-muted-foreground">Slug</div>
                <div className="font-mono text-xs">{category.slug}</div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">
                  Created
                </div>
                <div>{formatDate(category.created_at)}</div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">
                  Last Updated
                </div>
                <div>{formatDate(category.updated_at)}</div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
