/**
 * OKR compatibility types.
 *
 * Why:
 * - Provides a stable import path (`src/types/okr.ts`) for new module integrations.
 * - Re-exports EOS OKR model types to avoid duplicating source-of-truth interfaces.
 */

export type {
  OKR as OKRRow,
  OKR as OKRWithKeyResults,
  OKRKeyResult as KeyResultRow,
  OKRCheckIn as OKRUpdateRow,
  OKRFormData as OKRFormDataExport,
  CreateOKRInput,
  OKRFilters,
  OKRStatus,
  OKRType,
  OKRStats,
  CreateKeyResultInput,
} from "@/modules/eos/types";

export type MeasurementUnit = "number" | "percentage" | "currency" | "custom";
export type UpdateFrequency = "daily" | "weekly" | "biweekly" | "monthly";
export type KeyResultStatus = "not_started" | "in_progress" | "completed" | "at_risk" | "off_track";
export type HealthStatus = "on_track" | "medium_risk" | "high_risk";

export type KeyResultHistoryRow = {
  id: string;
  key_result_id: string;
  previous_value: number | null;
  new_value: number;
  notes: string | null;
  updated_by: string;
  updated_at: string;
};

export const UPDATE_FREQUENCIES: Record<UpdateFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
};
