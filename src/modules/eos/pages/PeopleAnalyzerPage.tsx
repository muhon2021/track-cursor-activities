/**
 * People Analyzer — core values + GWC quarterly reviews.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePeopleReviews, useCreatePeopleReview } from "../hooks/usePeopleReviews";
import { useVTO } from "../hooks/useVTO";
import type { CoreValueRating, PeopleReviewOverall } from "../types";
import { EOSPermissionGate } from "../components/EOSPermissionGate";

const RATINGS: CoreValueRating[] = ["+++", "++", "+", "-", "--"];

export default function PeopleAnalyzerPage() {
  const { data: reviews, isLoading } = usePeopleReviews();
  const { data: vtoSections } = useVTO();
  const { data: profiles } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data || [];
    },
  });
  const createReview = useCreatePeopleReview();

  const coreValues =
    ((vtoSections?.find((s) => s.section === "core_values")?.content?.values as string[]) || []);

  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [period, setPeriod] = useState("2026-Q2");
  const [scores, setScores] = useState<Record<string, CoreValueRating>>({});
  const [gwc, setGwc] = useState({ gets: false, wants: false, capacity: false });
  const [overall, setOverall] = useState<PeopleReviewOverall>("good");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (!userId) return;
    await createReview.mutateAsync({
      user_id: userId,
      review_period: period,
      core_values_scores: scores,
      gwc_gets_it: gwc.gets,
      gwc_wants_it: gwc.wants,
      gwc_has_capacity: gwc.capacity,
      overall_score: overall,
      notes: notes || undefined,
    });
    setShowForm(false);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            People Analyzer
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Evaluate team members on core values and GWC (Gets it, Wants it, Capacity)
          </p>
        </div>
        <EOSPermissionGate permission="eos.manage_rocks">
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Review
          </Button>
        </EOSPermissionGate>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New People Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Team Member</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    {(profiles || []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Review Period</Label>
                <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
              </div>
            </div>

            {coreValues.length > 0 && (
              <div>
                <Label className="mb-2 block">Core Values</Label>
                <div className="space-y-2">
                  {coreValues.map((val) => (
                    <div key={val} className="flex items-center gap-2">
                      <span className="text-sm w-40 truncate">{val}</span>
                      <Select
                        value={scores[val] || "+"}
                        onValueChange={(v) =>
                          setScores((s) => ({ ...s, [val]: v as CoreValueRating }))
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RATINGS.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              {[
                { key: "gets" as const, label: "Gets It" },
                { key: "wants" as const, label: "Wants It" },
                { key: "capacity" as const, label: "Capacity To Do It" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded border p-3">
                  <Label>{label}</Label>
                  <Switch
                    checked={gwc[key]}
                    onCheckedChange={(v) => setGwc((g) => ({ ...g, [key]: v }))}
                  />
                </div>
              ))}
            </div>

            <div>
              <Label>Overall Score</Label>
              <Select value={overall} onValueChange={(v) => setOverall(v as PeopleReviewOverall)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="needs_attention">Needs Attention</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={createReview.isPending}>
                {createReview.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Review
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !reviews?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No reviews yet. Create the first People Analyzer review.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{r.user?.full_name ?? "Unknown"}</CardTitle>
                  <Badge variant={r.overall_score === "needs_attention" ? "destructive" : "secondary"}>
                    {r.overall_score.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.review_period}</p>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex gap-2">
                  <Badge variant="outline">G: {r.gwc_gets_it ? "✓" : "✗"}</Badge>
                  <Badge variant="outline">W: {r.gwc_wants_it ? "✓" : "✗"}</Badge>
                  <Badge variant="outline">C: {r.gwc_has_capacity ? "✓" : "✗"}</Badge>
                </div>
                {r.notes && <p className="text-muted-foreground">{r.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
