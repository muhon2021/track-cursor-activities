/**
 * Level 10 Meeting Runner — structured agenda with timer and notes.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, Pause, SkipForward, CheckCircle2, ArrowLeft } from "lucide-react";
import {
  useL10Sections,
  useUpdateL10Section,
  useCreateL10Todo,
} from "../hooks/useL10Meeting";
import { L10_SECTION_LABELS, type L10SectionKey } from "../types";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function L10MeetingRunnerPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { data: sections, isLoading } = useL10Sections(meetingId);
  const updateSection = useUpdateL10Section();
  const createTodo = useCreateL10Todo();

  const { data: meeting } = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at")
        .eq("id", meetingId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!meetingId,
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState("");
  const [newTodo, setNewTodo] = useState("");

  const currentSection = sections?.[currentIndex];
  const durationSecs = (currentSection?.duration_minutes ?? 5) * 60;
  const progress = durationSecs > 0 ? Math.min((elapsed / durationSecs) * 100, 100) : 0;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    setNotes(currentSection?.notes ?? "");
    setElapsed(0);
    setRunning(false);
  }, [currentIndex, currentSection?.id]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const saveNotes = useCallback(async () => {
    if (!currentSection || !meetingId) return;
    await updateSection.mutateAsync({
      id: currentSection.id,
      meetingId,
      notes,
    });
  }, [currentSection, meetingId, notes, updateSection]);

  const completeSection = async () => {
    if (!currentSection || !meetingId) return;
    await updateSection.mutateAsync({
      id: currentSection.id,
      meetingId,
      notes,
      completed_at: new Date().toISOString(),
    });
    if (currentIndex < (sections?.length ?? 0) - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const addTodo = async () => {
    if (!newTodo.trim() || !meetingId) return;
    await createTodo.mutateAsync({ title: newTodo, meetingId });
    setNewTodo("");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/eos/meetings/schedule">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">L10 Meeting</h1>
          <p className="text-muted-foreground text-sm">{meeting?.title ?? "Meeting"}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {sections?.map((s, i) => (
          <Badge
            key={s.id}
            variant={i === currentIndex ? "default" : s.completed_at ? "secondary" : "outline"}
            className="cursor-pointer"
            onClick={() => setCurrentIndex(i)}
          >
            {s.completed_at && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {L10_SECTION_LABELS[s.section_key as L10SectionKey]}
          </Badge>
        ))}
      </div>

      {currentSection && (
        <Card>
          <CardHeader>
            <CardTitle>
              {L10_SECTION_LABELS[currentSection.section_key as L10SectionKey]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-3xl font-mono font-bold">{formatTime(elapsed)}</span>
              <span className="text-muted-foreground text-sm">
                / {currentSection.duration_minutes} min
              </span>
              <Button size="icon" variant="outline" onClick={() => setRunning(!running)}>
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setCurrentIndex((i) => Math.min(i + 1, (sections?.length ?? 1) - 1))}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
            <Progress value={progress} className="h-2" />

            <div>
              <label className="text-sm font-medium">Section Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="mt-1"
                placeholder="Capture notes for this section..."
              />
              <Button size="sm" variant="outline" className="mt-2" onClick={saveNotes}>
                Save Notes
              </Button>
            </div>

            {currentSection.section_key === "todo_review" && (
              <div className="flex gap-2">
                <Input
                  placeholder="New action item..."
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTodo()}
                />
                <Button onClick={addTodo}>Add Todo</Button>
              </div>
            )}

            <Button onClick={completeSection} className="w-full">
              Complete Section
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
