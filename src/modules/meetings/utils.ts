/**
 * Meetings Module Utilities
 *
 * Shared formatting helpers for dates, timezones, and recurrence patterns.
 */

import { parseMeetingDate, isMeetingDateValid } from "@/lib/date-utils";

/**
 * Format a scheduled_at timestamp with optional timezone label.
 * Falls back to the browser locale if no timezone is stored.
 * Uses Safari-safe date parsing; returns "Invalid date" for unparseable values.
 */
export function formatMeetingDateTime(
  scheduledAt: string,
  timezone?: string | null
): string {
  const date = parseMeetingDate(scheduledAt);
  if (!isMeetingDateValid(date)) {
    return "Invalid date";
  }

  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timezone ? { timeZone: timezone } : {}),
  };

  let formatted: string;
  try {
    formatted = date.toLocaleString(undefined, options);
  } catch {
    // Invalid timezone string — fall back without it
    formatted = date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  if (timezone) {
    formatted += ` (${timezone})`;
  }

  return formatted;
}

/**
 * Parse an iCal RRULE or simple recurrence keyword into a human-readable string.
 *
 * Supports:
 *  - Simple keywords: "daily", "weekly", "biweekly", "monthly", "yearly"
 *  - iCal RRULE format: "FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=2"
 */
export function formatRecurrencePattern(pattern: string): string {
  if (!pattern) return "";

  // Simple keyword match
  const simpleLabels: Record<string, string> = {
    daily: "Every day",
    weekly: "Every week",
    biweekly: "Every 2 weeks",
    monthly: "Every month",
    yearly: "Every year",
  };

  const lower = pattern.toLowerCase().trim();
  if (simpleLabels[lower]) return simpleLabels[lower];

  // iCal RRULE parsing
  const freqMatch = pattern.match(/FREQ=(\w+)/);
  if (!freqMatch) return pattern;

  const freq = freqMatch[1].toLowerCase();
  const intervalMatch = pattern.match(/INTERVAL=(\d+)/);
  const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
  const dayMatch = pattern.match(/BYDAY=([\w,]+)/);

  const freqLabels: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    biweekly: "Bi-weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  };

  let label = interval > 1
    ? `Every ${interval} ${freq}s`
    : freqLabels[freq] || freq;

  if (dayMatch) {
    const dayMap: Record<string, string> = {
      MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun",
    };
    const days = dayMatch[1].split(",").map((d) => dayMap[d] || d).join(", ");
    label += ` on ${days}`;
  }

  return label;
}
