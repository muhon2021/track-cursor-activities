/**
 * EOS Todos — tasks originating from meetings, IDS, or rocks.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckSquare, ExternalLink } from "lucide-react";
import { useEOSTodos, useUpdateEOSTodoStatus, type EOSTodoFilters } from "../hooks/useEOSTodos";
import { EOS_ROUTES } from "@/lib/eos-routes";
import type { EOSTodoSourceType } from "../types";

const SOURCE_LABELS: Record<EOSTodoSourceType, string> = {
  meeting: "Meeting",
  ids: "IDS",
  rock: "Rock",
};

const SOURCE_LINKS: Record<EOSTodoSourceType, (id: string) => string> = {
  meeting: (id) => `/eos/meetings/l10/${id}`,
  ids: (id) => `${EOS_ROUTES.ids}/${id}`,
  rock: () => EOS_ROUTES.rocks,
};

export default function EOSTodosPage() {
  const [filters, setFilters] = useState<EOSTodoFilters>({ status: "all", sourceType: "all" });
  const [search, setSearch] = useState("");
  const { data: todos, isLoading } = useEOSTodos({ ...filters, search: search || undefined });
  const updateStatus = useUpdateEOSTodoStatus();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CheckSquare className="h-6 w-6" />
          EOS Todos
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Action items from Level 10 meetings, IDS, and Rocks
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search todos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={filters.status || "all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v as EOSTodoFilters["status"] }))}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.sourceType || "all"}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, sourceType: v as EOSTodoFilters["sourceType"] }))
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="ids">IDS</SelectItem>
            <SelectItem value="rock">Rock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !todos?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No EOS todos yet. They will appear when created from L10 meetings, IDS, or Rocks.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {todos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              onToggle={(done) =>
                updateStatus.mutate({ id: todo.id, status: done ? "done" : "todo" })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TodoRow({
  todo,
  onToggle,
}: {
  todo: {
    id: string;
    title: string;
    status: string;
    due_date: string | null;
    priority: string | null;
    eos_source_type: EOSTodoSourceType | null;
    eos_source_id: string | null;
    assignee?: { full_name: string } | null;
  };
  onToggle: (done: boolean) => void;
}) {
  const isDone = todo.status === "done" || todo.status === "completed";
  const sourceType = todo.eos_source_type as EOSTodoSourceType | null;

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3">
        <Checkbox checked={isDone} onCheckedChange={(v) => onToggle(!!v)} />
        <div className="flex-1 min-w-0">
          <p className={isDone ? "line-through text-muted-foreground" : "font-medium"}>
            {todo.title}
          </p>
          <div className="flex gap-2 mt-1 flex-wrap">
            {todo.assignee && (
              <span className="text-xs text-muted-foreground">{todo.assignee.full_name}</span>
            )}
            {todo.due_date && (
              <span className="text-xs text-muted-foreground">Due {todo.due_date}</span>
            )}
            {sourceType && (
              <Badge variant="outline" className="text-xs">
                {SOURCE_LABELS[sourceType]}
              </Badge>
            )}
          </div>
        </div>
        {sourceType && todo.eos_source_id && (
          <Button variant="ghost" size="icon" asChild>
            <Link to={SOURCE_LINKS[sourceType](todo.eos_source_id)}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
