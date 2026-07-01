/**
 * Meeting Series Page
 *
 * Lists all recurring meeting series with create and archive controls.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Repeat, Loader2 } from "lucide-react";
import {
  useMeetingSeries,
  useCreateSeries,
  useArchiveSeries,
} from "../hooks/useRecurringMeetings";
import { SeriesCard } from "../components/series/SeriesCard";

const recurrenceOptions = [
  { value: "FREQ=DAILY", label: "Daily" },
  { value: "FREQ=WEEKLY;BYDAY=MO", label: "Weekly (Monday)" },
  { value: "FREQ=WEEKLY;BYDAY=TU", label: "Weekly (Tuesday)" },
  { value: "FREQ=WEEKLY;BYDAY=WE", label: "Weekly (Wednesday)" },
  { value: "FREQ=WEEKLY;BYDAY=TH", label: "Weekly (Thursday)" },
  { value: "FREQ=WEEKLY;BYDAY=FR", label: "Weekly (Friday)" },
  { value: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", label: "Bi-weekly (Monday)" },
  { value: "FREQ=MONTHLY", label: "Monthly" },
];

export default function MeetingSeriesPage() {
  const { data: seriesList = [], isLoading } = useMeetingSeries();
  const createSeries = useCreateSeries();
  const archiveSeries = useArchiveSeries();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recurrence, setRecurrence] = useState("FREQ=WEEKLY;BYDAY=MO");
  const [duration, setDuration] = useState("60");

  const handleCreate = () => {
    if (!title.trim()) return;
    createSeries.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        recurrence_rule: recurrence,
        duration_minutes: parseInt(duration) || 60,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setRecurrence("FREQ=WEEKLY;BYDAY=MO");
          setDuration("60");
          setIsCreateOpen(false);
        },
      }
    );
  };

  const handleArchive = (id: string) => {
    archiveSeries.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meeting Series</h1>
          <p className="text-muted-foreground">Recurring meeting definitions</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Series
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Meeting Series</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Series name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger>
                  <SelectValue placeholder="Recurrence pattern" />
                </SelectTrigger>
                <SelectContent>
                  {recurrenceOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Duration (minutes)"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min={5}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!title.trim() || createSeries.isPending}
              >
                {createSeries.isPending ? "Creating..." : "Create Series"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {seriesList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Repeat className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No meeting series</p>
          <p className="text-sm">Create a recurring meeting series to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {seriesList.map((series) => (
            <SeriesCard
              key={series.id}
              series={series}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
