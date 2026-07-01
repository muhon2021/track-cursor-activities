/**
 * Date Time Picker
 *
 * Wrapper around a native datetime-local input styled with shadcn Input.
 * Displays an optional label and timezone indicator.
 */

import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  timezone?: string;
  label?: string;
  disabled?: boolean;
}

export default function DateTimePicker({
  value,
  onChange,
  timezone,
  label,
  disabled,
}: DateTimePickerProps) {
  return (
    <div>
      {label && (
        <label className="text-sm font-medium mb-1 block">{label}</label>
      )}
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="pl-10"
        />
      </div>
      {timezone && (
        <p className="text-xs text-muted-foreground mt-1">{timezone}</p>
      )}
    </div>
  );
}
