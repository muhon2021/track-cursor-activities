/**
 * Business Development Module Types
 */

export type DealStage = "lead" | "discovery" | "qualified" | "estimation" | "proposal" | "won" | "lost";

export interface Deal {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  stage: DealStage;
  value: number | null;
  currency: string;
  probability: number;
  client_id: string | null;
  contact_id: string | null;
  owner_id: string | null;
  expected_close_date: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  source: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  data_source: string | null;
  external_id: string | null;
  external_url: string | null;
  last_synced_at: string | null;
  owner?: { full_name: string; email: string } | null;
  client?: { name: string } | null;
  contact?: { first_name: string; last_name: string | null; email: string | null } | null;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  user_id: string | null;
  activity_type: "note" | "call" | "email" | "meeting" | "stage_change" | "task";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  user?: { full_name: string } | null;
}

export interface DealComment {
  id: string;
  deal_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: { full_name: string; email: string } | null;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  linkedin_url: string | null;
  client_id: string | null;
  source: string;
  tags: string[];
  notes: string | null;
  last_contacted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  followup?: LeadFollowUp | null;
}

export interface LeadFollowUp {
  id: string;
  contact_id: string;
  status: "new" | "contacted" | "interested" | "not_interested" | "converted" | "dormant";
  priority: "low" | "medium" | "high";
  next_follow_up: string | null;
  follow_up_notes: string | null;
  assigned_to: string | null;
  converted_deal_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DealActivityType = "note" | "call" | "email" | "meeting" | "stage_change" | "task";

export interface DealFormData {
  title: string;
  description?: string;
  stage?: DealStage;
  value?: number;
  probability?: number;
  client_id?: string;
  contact_id?: string;
  owner_id?: string;
  expected_close_date?: string;
  source?: string;
  tags?: string[];
  deal_type?: string;
  category?: string;
  pipeline?: string;
  assigned_pod?: string;
  next_step?: string;
}

export interface DealFilters {
  stage?: DealStage | "all";
  owner_id?: string;
  client_id?: string;
  search?: string;
  excludeLost?: boolean;
}

export interface ContactFormData {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  client_id?: string;
}

export interface DealPipelineStats {
  total_deals: number;
  total_value: number;
  by_stage: Record<DealStage, { count: number; value: number }>;
  avg_probability: number;
}
