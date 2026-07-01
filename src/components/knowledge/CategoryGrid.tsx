import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderTree, BookOpen, FileText } from "lucide-react";

// Map icon names to components
const iconMap: Record<string, React.ElementType> = {
  FolderTree,
  BookOpen,
  FileText,
};

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

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
}

interface CategoryGridProps {
  categories: Category[];
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string | null) => void;
  entryCount?: (categoryId: string) => number;
  loading?: boolean;
}

export function CategoryGrid({
  categories,
  selectedCategory,
  onCategorySelect,
  entryCount,
  loading = false,
}: CategoryGridProps) {
  const getCategoryIcon = (iconName?: string | null) => {
    const Icon = iconName ? iconMap[iconName] || FolderTree : FolderTree;
    return Icon;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Browse by Category</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 rounded bg-gray-200" />
                    <div className="h-3 w-16 rounded bg-gray-100" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Browse by Category</h2>
        {selectedCategory && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCategorySelect(null)}
          >
            Clear Filter
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((category) => {
          const Icon = getCategoryIcon(category.icon);
          const colorClass =
            CATEGORY_COLORS[category.color || "blue"] || "bg-blue-500";
          const count = entryCount ? entryCount(category.id) : 0;

          return (
            <Card
              key={category.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedCategory === category.id
                  ? "border-primary ring-2 ring-primary/20"
                  : ""
              }`}
              onClick={() =>
                onCategorySelect(
                  selectedCategory === category.id ? null : category.id
                )
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass} text-white`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">
                      {category.name}
                    </CardTitle>
                    {entryCount && (
                      <p className="text-xs text-muted-foreground">
                        {count} {count === 1 ? "entry" : "entries"}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              {category.description && (
                <CardContent className="pt-0">
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {category.description}
                  </p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
