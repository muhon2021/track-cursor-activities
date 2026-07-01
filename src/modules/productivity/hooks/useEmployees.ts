/**
 * Employees Hook - Employee profile queries
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EmployeeProfile, ProductivityRecord } from "../types";

const EMPLOYEES_KEY = "employees";

export function useEmployeeByEmail(email: string) {
  return useQuery({
    queryKey: [EMPLOYEES_KEY, email],
    queryFn: async (): Promise<EmployeeProfile | null> => {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("*, department:department_id(name)")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      return data as EmployeeProfile | null;
    },
    enabled: !!email,
  });
}

export function useEmployeeProductivity(email: string, limit = 12) {
  return useQuery({
    queryKey: [EMPLOYEES_KEY, email, "productivity", limit],
    queryFn: async (): Promise<ProductivityRecord[]> => {
      const { data, error } = await supabase
        .from("productivity_records")
        .select("*")
        .eq("employee_email", email)
        .order("week_start", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as ProductivityRecord[];
    },
    enabled: !!email,
  });
}
