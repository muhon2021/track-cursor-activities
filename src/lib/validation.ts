import { z } from "zod";

// Email validation
export const emailSchema = z.string().email("Invalid email address");

export function validateEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// URL validation
export const urlSchema = z.string().url("Invalid URL");

export function validateUrl(url: string): boolean {
  return urlSchema.safeParse(url).success;
}

// String sanitization
export function sanitizeString(str: string): string {
  return str.trim().replace(/\s+/g, " ");
}

// Phone validation
export const phoneSchema = z.string().regex(/^\+?[\d\s\-()]+$/, "Invalid phone number");

export function validatePhone(phone: string): boolean {
  return phoneSchema.safeParse(phone).success;
}

// Form validation helpers
export function isRequired(value: any): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}

export function minLength(value: string, min: number): boolean {
  return value.length >= min;
}

export function maxLength(value: string, max: number): boolean {
  return value.length <= max;
}

// Common validation schemas - aligned with form requirements
export const clientStatusEnum = z.enum(["active", "inactive"]);

export const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  company: z.string().optional(),
  phone: z.string().optional(),
  status: clientStatusEnum.optional().default("active"),
  notes: z.string().optional(),
});

export const meetingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  meeting_date: z.string().min(1, "Date is required"),
  duration_minutes: z.number().min(1, "Duration must be at least 1 minute").optional(),
  description: z.string().optional(),
  client_id: z.string().optional().or(z.literal("")),
  provider: z.enum(["zoom", "google_meet", "microsoft_teams", "webex", "other"]).optional(),
  external_meeting_id: z.string().optional(),
  join_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  host_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  zoom_meeting_id: z.string().optional(),
  zoom_join_url: z.string().optional(),
});

export const knowledgeEntrySchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.string().min(1, "Status is required"),
  priority: z.string().min(1, "Priority is required"),
  due_date: z.string().optional(),
  assigned_to: z.string().optional().or(z.literal("")),
  client_id: z.string().optional().or(z.literal("")),
  meeting_id: z.string().optional().or(z.literal("")),
});

export const dealSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().optional().or(z.literal("")),
  stage: z.enum(["lead", "discovery", "estimation", "proposal", "won", "lost"]).optional(),
  value: z.number().min(0, "Value must be positive").optional().nullable(),
  client_id: z.string().uuid().optional().or(z.literal("")),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  owner_id: z.string().uuid().optional().or(z.literal("")),
  expected_close_date: z.string().optional().or(z.literal("")),
  source: z.string().optional().or(z.literal("")),
});

export const contactSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional().or(z.literal("")),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: phoneSchema.optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  title: z.string().optional().or(z.literal("")),
  client_id: z.string().uuid().optional().or(z.literal("")),
});

export type ClientFormData = z.infer<typeof clientSchema>;
export type MeetingFormData = z.infer<typeof meetingSchema>;
export type KnowledgeEntryFormData = z.infer<typeof knowledgeEntrySchema>;
export type TaskFormData = z.infer<typeof taskSchema>;
export type DealValidatedFormData = z.infer<typeof dealSchema>;
export type ContactValidatedFormData = z.infer<typeof contactSchema>;

// Teams meeting creation schema with production-safe validation
export const createTeamsMeetingSchema = z.object({
  title: z.string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  
  startDateTime: z.string()
    .min(1, "Start time is required")
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid start date/time")
    .refine((val) => {
      const date = new Date(val);
      // Allow 1 minute buffer for form submission
      return date.getTime() > Date.now() - 60000;
    }, "Start time must be in the future"),
  
  endDateTime: z.string()
    .min(1, "End time is required")
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid end date/time"),
  
  attendees: z.array(
    z.string().email("Invalid email address").trim().toLowerCase()
  ).optional().default([]),
}).refine((data) => {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["endDateTime"],
}).refine((data) => {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  const durationMs = end.getTime() - start.getTime();
  const maxDuration = 24 * 60 * 60 * 1000; // 24 hours
  return durationMs <= maxDuration;
}, {
  message: "Meeting cannot be longer than 24 hours",
  path: ["endDateTime"],
}).refine((data) => {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  const durationMs = end.getTime() - start.getTime();
  const minDuration = 5 * 60 * 1000; // 5 minutes
  return durationMs >= minDuration;
}, {
  message: "Meeting must be at least 5 minutes",
  path: ["endDateTime"],
});

export type CreateTeamsMeetingInput = z.infer<typeof createTeamsMeetingSchema>;

// Zoom meeting creation schema with production-safe validation
export const createZoomMeetingSchema = z.object({
  title: z.string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  
  startDateTime: z.string()
    .min(1, "Start time is required")
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid start date/time")
    .refine((val) => {
      const date = new Date(val);
      // Allow 1 minute buffer for form submission
      return date.getTime() > Date.now() - 60000;
    }, "Start time must be in the future"),
  
  endDateTime: z.string()
    .min(1, "End time is required")
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid end date/time"),
  
  attendees: z.array(
    z.string().email("Invalid email address").trim().toLowerCase()
  ).optional().default([]),
  
  agenda: z.string().optional(),
}).refine((data) => {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["endDateTime"],
}).refine((data) => {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  const durationMs = end.getTime() - start.getTime();
  const maxDuration = 24 * 60 * 60 * 1000; // 24 hours
  return durationMs <= maxDuration;
}, {
  message: "Meeting cannot be longer than 24 hours",
  path: ["endDateTime"],
}).refine((data) => {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  const durationMs = end.getTime() - start.getTime();
  const minDuration = 5 * 60 * 1000; // 5 minutes
  return durationMs >= minDuration;
}, {
  message: "Meeting must be at least 5 minutes",
  path: ["endDateTime"],
});

export type CreateZoomMeetingInput = z.infer<typeof createZoomMeetingSchema>;

// Google Meet meeting creation schema with production-safe validation
export const createGoogleMeetMeetingSchema = z.object({
  title: z.string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  
  startDateTime: z.string()
    .min(1, "Start time is required")
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid start date/time")
    .refine((val) => {
      const date = new Date(val);
      // Allow 1 minute buffer for form submission
      return date.getTime() > Date.now() - 60000;
    }, "Start time must be in the future"),
  
  endDateTime: z.string()
    .min(1, "End time is required")
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid end date/time"),
  
  attendees: z.array(
    z.string().email("Invalid email address").trim().toLowerCase()
  ).optional().default([]),
  
  description: z.string().optional(),
}).refine((data) => {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["endDateTime"],
}).refine((data) => {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  const durationMs = end.getTime() - start.getTime();
  const maxDuration = 24 * 60 * 60 * 1000; // 24 hours
  return durationMs <= maxDuration;
}, {
  message: "Meeting cannot be longer than 24 hours",
  path: ["endDateTime"],
}).refine((data) => {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  const durationMs = end.getTime() - start.getTime();
  const minDuration = 5 * 60 * 1000; // 5 minutes
  return durationMs >= minDuration;
}, {
  message: "Meeting must be at least 5 minutes",
  path: ["endDateTime"],
});

export type CreateGoogleMeetMeetingInput = z.infer<typeof createGoogleMeetMeetingSchema>;

export const departmentFormSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100),
  description: z.string().max(500).optional(),
  head_user_id: z.string().uuid().nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  parent_department_id: z.string().uuid().nullable().optional(),
});

export type DepartmentFormData = z.infer<typeof departmentFormSchema>;

export const roleFormSchema = z.object({
  name: z.string().min(1, "Role name is required").max(100),
  description: z.string().max(500).optional(),
  permissionKeys: z.array(z.string()).default([]),
});

export type RoleBuilderFormData = z.infer<typeof roleFormSchema>;

export const integrationKnowledgeSourceRefSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('integration'),
    slug: z.string().min(1, 'Integration slug is required'),
  }),
  z.object({
    kind: z.literal('internal'),
    source_type: z.string().min(1, 'Source type is required'),
  }),
]);

export const integrationPreferencesSchema = z.object({
  primary_integrations: z.array(z.string().min(1)),
  primary_knowledge_sources: z.array(integrationKnowledgeSourceRefSchema),
});

export type IntegrationPreferencesFormData = z.infer<typeof integrationPreferencesSchema>;