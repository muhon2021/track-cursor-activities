/**
 * Supabase helpers - per PROJECTS-EXACT-FILE-LIST. Add shared Supabase utilities as needed.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T];
type TablesInsert<T extends keyof Database["public"]["Tables"]> = Tables<T>["Insert"];
type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Tables<T>["Update"];
type TablesRow<T extends keyof Database["public"]["Tables"]> = Tables<T>["Row"];

export function getSupabaseErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: string }).message);
  return "An error occurred";
}

/**
 * Typed query helper - returns a typed Supabase query builder
 */
export function typedQuery<T extends keyof Database["public"]["Tables"]>(table: T) {
  return supabase.from(table);
}

/**
 * Typed insert helper - inserts a row and returns it
 */
export async function typedInsert<T extends keyof Database["public"]["Tables"]>(
  table: T,
  data: TablesInsert<T>
): Promise<{ data: any | null; error: unknown }> {
  const { data: inserted, error } = await (supabase as any)
    .from(table)
    .insert(data)
    .select()
    .single();
  
  return { data: inserted, error };
}

/**
 * Typed update helper - updates by id and returns the updated row
 */
export async function typedUpdate<T extends keyof Database["public"]["Tables"]>(
  table: T,
  id: string,
  data: TablesUpdate<T>
): Promise<{ data: any | null; error: unknown }> {
  const { data: updated, error } = await (supabase as any)
    .from(table)
    .update(data)
    .eq("id", id)
    .select()
    .single();
  
  return { data: updated, error };
}
