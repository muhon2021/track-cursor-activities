/**
 * Date utilities with Safari-safe parsing.
 *
 * Safari is strict about ISO 8601 and can return Invalid Date or parse
 * strings without timezone as UTC. parseMeetingDate normalizes input and
 * uses date-fns parseISO for consistent cross-browser behavior.
 */

import { parseISO, isValid as isDateFnsValid } from "date-fns";

const INVALID_DATE = new Date(NaN);

/**
 * Normalize an ISO-like string for Safari:
 * - Replace space between date and time with "T"
 * - If no timezone (no Z, no +/- offset), append "Z" so all browsers treat as UTC
 */
function normalizeISOString(value: string): string {
  let s = value.trim();
  // Replace "YYYY-MM-DD HH:MM..." with "YYYY-MM-DDTHH:MM..."
  if (/^\d{4}-\d{2}-\d{2}\s+\d/.test(s)) {
    s = s.replace(/\s+/, "T");
  }
  // If no timezone, append Z for consistent parsing (Supabase timestamptz is UTC)
  if (!/Z|[+-]\d{2}:?\d{2}$/.test(s)) {
    s = s.replace(/\.\d+$/, "") + "Z";
  }
  return s;
}

/**
 * Parse a meeting scheduled_at (or similar) value in a Safari-safe way.
 * Returns Invalid Date (getTime() is NaN) for null, undefined, empty, or unparseable strings.
 */
export function parseMeetingDate(
  value: string | null | undefined
): Date {
  if (value == null || String(value).trim() === "") {
    return INVALID_DATE;
  }
  const str = String(value).trim();
  try {
    const normalized = normalizeISOString(str);
    const date = parseISO(normalized);
    return date;
  } catch {
    return INVALID_DATE;
  }
}

/**
 * Re-export date-fns isValid for guarding format() calls.
 */
export { isDateFnsValid as isMeetingDateValid };
