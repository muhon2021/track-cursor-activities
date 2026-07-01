/**
 * Meetings Calendar Component
 *
 * Monthly calendar view of meetings with day cells showing meeting indicators.
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseMeetingDate, isMeetingDateValid } from "@/lib/date-utils";
interface CalendarMeetingItem {
  id: string;
  title: string;
  scheduled_at: string | null;
  slug?: string | null;
}

interface MeetingsCalendarProps {
  meetings: CalendarMeetingItem[];
  getMeetingLink?: (meeting: CalendarMeetingItem) => string;
  /** When provided, calendar month is controlled by parent (for syncing with data fetch) */
  controlledMonth?: Date;
  onMonthChange?: (date: Date) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MeetingsCalendar({
  meetings,
  getMeetingLink = (m) => `/meetings/schedule/${m.slug || m.id}`,
  controlledMonth,
  onMonthChange,
}: MeetingsCalendarProps) {
  const navigate = useNavigate();
  const [internalDate, setInternalDate] = useState(new Date());
  const currentDate = controlledMonth ?? internalDate;
  const setCurrentDate = (d: Date) => {
    if (onMonthChange) onMonthChange(d);
    else setInternalDate(d);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month fill
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month
    for (let i = 1; i <= totalDays; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Next month fill
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  // Index meetings by date (local yyyy-MM-dd)
  const meetingsByDate = useMemo(() => {
    const map: Record<string, CalendarMeetingItem[]> = {};
    meetings.forEach((m) => {
      if (!m.scheduled_at) return;
      const d = parseMeetingDate(m.scheduled_at);
      if (!isMeetingDateValid(d)) return;
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(m);
    });
    return map;
  }, [meetings]);

  const today = toLocalDateKey(new Date());

  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-semibold text-lg min-w-[180px] text-center">
            {MONTHS[month]} {year}
          </h3>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Today
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted">
          {DAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, isCurrentMonth }, i) => {
            const dateKey = toLocalDateKey(date);
            const dayMeetings = meetingsByDate[dateKey] || [];
            const isToday = dateKey === today;

            return (
              <div
                key={i}
                className={`min-h-[100px] border-t border-r p-1.5 ${
                  !isCurrentMonth ? "bg-muted/30" : ""
                } ${isToday ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium ${
                      isToday
                        ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                        : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {dayMeetings.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      {dayMeetings.length}
                    </Badge>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayMeetings.slice(0, 3).map((m) => {
                    const d = m.scheduled_at ? parseMeetingDate(m.scheduled_at) : null;
                    const timeStr = d && isMeetingDateValid(d)
                      ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                      : "";
                    return (
                      <button
                        key={m.id}
                        className="w-full text-left text-[11px] px-1 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 truncate block"
                        onClick={() => navigate(getMeetingLink(m))}
                      >
                        {timeStr}{timeStr ? " " : ""}{m.title}
                      </button>
                    );
                  })}
                  {dayMeetings.length > 3 && (
                    <p className="text-[10px] text-muted-foreground px-1">
                      +{dayMeetings.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
