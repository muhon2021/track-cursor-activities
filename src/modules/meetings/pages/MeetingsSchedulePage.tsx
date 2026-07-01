/**
 * Meetings Schedule Page
 *
 * List/calendar view with KPIs, search, type filter, "My meetings only",
 * tabs (Today | Upcoming | Open | Past). Data from meetings_v2 via useMeetingsV2.
 */

import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { parseMeetingDate, isMeetingDateValid } from "@/lib/date-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MeetingSeriesPage from "./MeetingSeriesPage";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Calendar,
  List,
  Search,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
} from "lucide-react";
import { useMeetingsV2 } from "../hooks/useMeetingsV2";
import { useCalendarMeetingsV2 } from "../hooks/useCalendarMeetings";
import { MeetingsCalendar } from "../components/calendar/MeetingsCalendar";
import CreateMeetingDialog from "../components/dialogs/CreateMeetingDialog";
import type { MeetingPlatformSlug } from "../components/dialogs/CreateMeetingDialog";
import type { MeetingV2Schedule, MeetingType } from "../types/meetings";
import { CreateZoomMeetingDialog } from "@/components/meetings/CreateZoomMeetingDialog";
import { CreateTeamsMeetingDialog } from "@/components/meetings/CreateTeamsMeetingDialog";
import { CreateGoogleMeetMeetingDialog } from "@/components/meetings/CreateGoogleMeetMeetingDialog";
import { useToast } from "@/hooks/use-toast";
import { AgentTeamBanner } from "@/components/ai/AgentTeamBanner";
import { MeetingIntegrationBanner } from "@/components/common/MeetingIntegrationBanner";
import { AIAgentPresenceIndicator } from "@/components/ai/AIAgentPresenceIndicator";
import { FellowRecordingsStrip } from "../components/FellowRecordingsStrip";

const VIEW_MODE_KEY = "meetings-view-mode";
type ViewMode = "list" | "calendar";
type TabFilter = "today" | "upcoming" | "open" | "past";

const statusBadges: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  scheduled: { label: "Scheduled", variant: "default" },
  in_progress: { label: "In Progress", variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

const typeLabels: Record<MeetingType, string> = {
  internal: "Internal",
  client: "Client",
  project: "Project",
  l10: "L10",
  one_on_one: "One-on-One",
};

function getStoredViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === "list" || v === "calendar") return v;
  } catch {
    /* ignore */
  }
  return "list";
}

function setStoredViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export default function MeetingsSchedulePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>(getStoredViewMode);
  const [tab, setTab] = useState<TabFilter>("today");
  const [typeFilter, setTypeFilter] = useState<MeetingType | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [myMeetingsOnly, setMyMeetingsOnly] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [zoomDialogOpen, setZoomDialogOpen] = useState(false);
  const [teamsDialogOpen, setTeamsDialogOpen] = useState(false);
  const [googleMeetDialogOpen, setGoogleMeetDialogOpen] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  useEffect(() => {
    setStoredViewMode(view);
  }, [view]);

  // Open create dialog when URL has openCreate=1 or connected (return from OAuth)
  useEffect(() => {
    const openCreate = searchParams.get("openCreate");
    const connected = searchParams.get("connected");
    if (openCreate === "1" || connected) {
      setCreateDialogOpen(true);
      if (connected) {
        toast({
          title: "Connected",
          description: "Click **Create meeting** on your connected platform in the dialog to continue.",
        });
      }
      const next = new URLSearchParams(searchParams);
      next.delete("openCreate");
      next.delete("connected");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  const handleSelectPlatform = (platform: MeetingPlatformSlug) => {
    setCreateDialogOpen(false);
    if (platform === "zoom") setZoomDialogOpen(true);
    else if (platform === "microsoft-teams") setTeamsDialogOpen(true);
    else if (platform === "google-meet") setGoogleMeetDialogOpen(true);
  };

  const { data: meetings = [], isLoading } = useMeetingsV2({
    tab,
    type: typeFilter !== "all" ? typeFilter : undefined,
    search: appliedSearch || undefined,
    my_meetings_only: myMeetingsOnly,
  });

  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthNum = calendarMonth.getMonth() + 1;
  const { data: calendarByDate = {} } = useCalendarMeetingsV2(
    calendarYear,
    calendarMonthNum
  );
  const calendarMeetingsList = useMemo(
    () => Object.values(calendarByDate).flat(),
    [calendarByDate]
  );

  const kpis = useMemo(() => {
    const total = meetings.length;
    const completed = meetings.filter((m) => m.status === "completed").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const now = new Date();
    const upcoming = meetings.filter((m) => {
      if (m.status !== "scheduled" || !m.scheduled_at) return false;
      const d = parseMeetingDate(m.scheduled_at);
      return isMeetingDateValid(d) && d >= now;
    }).length;
    return { total, completionRate, upcoming };
  }, [meetings]);

  const groupedByWeek = useMemo(() => {
    if (tab !== "upcoming") return null;
    const groups: Record<string, MeetingV2Schedule[]> = {};
    const now = new Date();
    meetings.forEach((m) => {
      if (!m.scheduled_at) return;
      const meetingDate = parseMeetingDate(m.scheduled_at);
      if (!isMeetingDateValid(meetingDate) || meetingDate <= now) return;
      const weekStart = startOfWeek(meetingDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, "yyyy-MM-dd");
      if (!groups[weekKey]) groups[weekKey] = [];
      groups[weekKey].push(m);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekKey, weekMeetings]) => ({
        weekKey,
        weekStart: parseISO(weekKey),
        meetings: weekMeetings.sort((a, b) =>
          (a.scheduled_at || "").localeCompare(b.scheduled_at || "")
        ),
      }));
  }, [meetings, tab]);

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  };

  const handleMeetingClick = (meeting: MeetingV2Schedule) => {
    const path = meeting.slug
      ? `/meetings/schedule/${meeting.slug}`
      : `/meetings/schedule/${meeting.id}`;
    navigate(path);
  };

  const handleSearchSubmit = () => {
    setAppliedSearch(searchInput.trim());
  };

  const isEmpty =
    !isLoading &&
    meetings.length === 0 &&
    (view !== "calendar" || calendarMeetingsList.length === 0);

  const outerView = searchParams.get("view") === "series" ? "series" : "meetings";
  const setOuterView = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === "meetings") next.delete("view");
    else next.set("view", v);
    setSearchParams(next, { replace: true });
  };

  return (
    <Tabs value={outerView} onValueChange={setOuterView} className="space-y-4">
      <TabsList>
        <TabsTrigger value="meetings">All Meetings</TabsTrigger>
        <TabsTrigger value="series">Series</TabsTrigger>
      </TabsList>
      <TabsContent value="series" className="mt-4"><MeetingSeriesPage /></TabsContent>
      <TabsContent value="meetings" className="mt-4">
    <div className="space-y-6">
      <AgentTeamBanner team="meetings" />
      <MeetingIntegrationBanner page="schedule" />
      <div className="flex flex-wrap gap-2">
        <AIAgentPresenceIndicator agentName="Meeting Summarizer" agentSlug="meeting-summarizer" gradientFrom="190 80% 45%" gradientTo="210 85% 55%" />
        <AIAgentPresenceIndicator agentName="Action Item Extractor" agentSlug="action-item-extractor" gradientFrom="190 80% 45%" gradientTo="210 85% 55%" />
      </div>
      {/* Header: title + subtitle left; List | Calendar | New Meeting right */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage and track all your meetings in one place
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <div className="flex border rounded-md">
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              className="gap-1.5"
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              variant={view === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("calendar")}
              className="gap-1.5"
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </Button>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Meeting
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Meetings</p>
              <p className="text-3xl font-bold">{kpis.total}</p>
            </div>
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <p className="text-3xl font-bold">{kpis.completionRate}%</p>
            </div>
            <CheckCircle className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-3xl font-bold">{kpis.upcoming}</p>
            </div>
            <Clock className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <FellowRecordingsStrip />

      {/* Search and filters: search (icon inside) + button + All Types + My meetings only */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search meetings..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
            className="pl-9"
          />
        </div>
        <Button type="button" variant="secondary" size="icon" onClick={handleSearchSubmit}>
          <Search className="h-4 w-4" />
        </Button>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as MeetingType | "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="project">Project</SelectItem>
            <SelectItem value="l10">L10</SelectItem>
            <SelectItem value="one_on_one">One-on-One</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="my-meetings"
            checked={myMeetingsOnly}
            onCheckedChange={(c) => setMyMeetingsOnly(c === true)}
          />
          <Label htmlFor="my-meetings" className="text-sm font-normal cursor-pointer">
            My meetings only
          </Label>
        </div>
      </div>

      {/* Tabs: Today | Upcoming | Open | Past */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : view === "calendar" ? (
        <MeetingsCalendar
          meetings={calendarMeetingsList}
          controlledMonth={calendarMonth}
          onMonthChange={setCalendarMonth}
        />
      ) : tab === "upcoming" && groupedByWeek && groupedByWeek.length > 0 ? (
        <div className="space-y-4">
          {groupedByWeek.map(({ weekKey, weekStart, meetings: weekMeetings }) => {
            const isExpanded = expandedWeeks.has(weekKey);
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
            const weekLabel = isMeetingDateValid(weekStart)
              ? `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
              : weekKey;
            return (
              <Collapsible
                key={weekKey}
                open={isExpanded}
                onOpenChange={() => toggleWeek(weekKey)}
              >
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-semibold">{weekLabel}</span>
                        <Badge variant="secondary">{weekMeetings.length}</Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Meeting</TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weekMeetings.map((meeting) => (
                          <TableRow
                            key={meeting.id}
                            className="cursor-pointer"
                            onClick={() => handleMeetingClick(meeting)}
                          >
                            <TableCell>
                              <p className="font-medium">{meeting.title}</p>
                            </TableCell>
                            <TableCell>
                              {meeting.scheduled_at ? (() => {
                                const d = parseMeetingDate(meeting.scheduled_at);
                                if (!isMeetingDateValid(d)) return <span className="text-sm text-muted-foreground">—</span>;
                                return (
                                  <div className="text-sm">
                                    <p>{format(d, "MMM d, yyyy")}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(d, "h:mm a")}
                                    </p>
                                  </div>
                                );
                              })() : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {meeting.duration_minutes}m
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {typeLabels[meeting.type] ?? meeting.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {statusBadges[meeting.status] ? (
                                <Badge variant={statusBadges[meeting.status].variant}>
                                  {statusBadges[meeting.status].label}
                                </Badge>
                              ) : (
                                <Badge variant="outline">{meeting.status}</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      ) : isEmpty || (view === "list" && meetings.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-semibold">No meetings found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Get started by creating your first meeting
          </p>
          <Button
            className="mt-4"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Meeting
          </Button>
        </div>
      ) : view === "list" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meeting</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meetings.map((meeting) => (
                <TableRow
                  key={meeting.id}
                  className="cursor-pointer"
                  onClick={() => handleMeetingClick(meeting)}
                >
                  <TableCell>
                    <p className="font-medium">{meeting.title}</p>
                  </TableCell>
                  <TableCell>
                    {meeting.scheduled_at ? (() => {
                      const d = parseMeetingDate(meeting.scheduled_at);
                      if (!isMeetingDateValid(d)) return <span className="text-sm text-muted-foreground">—</span>;
                      return (
                        <div className="text-sm">
                          <p>{format(d, "MMM d, yyyy")}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(d, "h:mm a")}
                          </p>
                        </div>
                      );
                    })() : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {meeting.duration_minutes}m
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{typeLabels[meeting.type] ?? meeting.type}</Badge>
                  </TableCell>
                  <TableCell>
                    {statusBadges[meeting.status] ? (
                      <Badge variant={statusBadges[meeting.status].variant}>
                        {statusBadges[meeting.status].label}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{meeting.status}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      </Tabs>

      <CreateMeetingDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSelectPlatform={handleSelectPlatform}
      />
      <CreateZoomMeetingDialog
        open={zoomDialogOpen}
        onOpenChange={setZoomDialogOpen}
      />
      <CreateTeamsMeetingDialog
        open={teamsDialogOpen}
        onOpenChange={setTeamsDialogOpen}
      />
      <CreateGoogleMeetMeetingDialog
        open={googleMeetDialogOpen}
        onOpenChange={setGoogleMeetDialogOpen}
      />
    </div>
      </TabsContent>
    </Tabs>
  );
}
