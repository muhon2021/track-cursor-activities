import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { ClientFormData } from "@/lib/validation";
import { useToast } from "@/hooks/use-toast";
import { logCrud } from "@/lib/activity-logger";

export interface Client {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  status: string | null;
  metadata: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  data_source: string | null;
  external_id: string | null;
  external_url: string | null;
  last_synced_at: string | null;
}

export type ClientSortBy = "name" | "created_at" | "company";
export type ClientSortOrder = "asc" | "desc";

export interface UseClientsResult {
  data: Client[] | undefined;
  totalCount: number;
  isLoading: boolean;
  error: Error | null;
}

export function useClients(
  filters?: Record<string, any> & {
    sortBy?: ClientSortBy;
    sortOrder?: ClientSortOrder;
    page?: number;
    pageSize?: number;
  }
): UseClientsResult {
  const sortBy = filters?.sortBy ?? "created_at";
  const sortOrder = filters?.sortOrder ?? "desc";
  const usePagination = filters?.page != null && filters?.pageSize != null;
  const page = filters?.page ?? 0;
  const pageSize = Math.min(Math.max(filters?.pageSize ?? 25, 1), 100);
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const query = useQuery({
    queryKey: queryKeys.clients.list(filters),
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("*", usePagination ? { count: "exact" } : undefined)
        .order(sortBy, { ascending: sortOrder === "asc", nullsFirst: sortBy === "company" ? false : undefined });

      if (filters?.search) {
        q = q.or(
          `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`
        );
      }

      if (filters?.status) {
        q = q.eq("status", filters.status);
      }

      if (usePagination) {
        q = q.range(from, to);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      const list = (data ?? []) as Client[];
      return {
        data: list,
        totalCount: usePagination ? (count ?? 0) : list.length,
      };
    },
  });

  const result = query.data;
  return {
    data: result?.data,
    totalCount: result?.totalCount ?? 0,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useClient(id: string) {
  return useQuery({
    queryKey: queryKeys.clients.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Client;
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ClientFormData) => {
      // Map form data to database columns (notes stored in metadata)
      const insertData = {
        name: data.name,
        email: data.email || null,
        company: data.company || null,
        phone: data.phone || null,
        status: data.status ?? "active",
        metadata: data.notes ? { notes: data.notes } : null,
      };
      
      const { data: client, error } = await supabase
        .from("clients")
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return client as Client;
    },
    onSuccess: (client) => {
      invalidateKeys.clients(queryClient);
      logCrud("create", "client", client.id, { name: client.name });
      toast({
        title: "Success",
        description: "Client created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create client",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientFormData> }) => {
      // Map form data to database columns
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.company !== undefined) updateData.company = data.company || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.notes !== undefined) updateData.metadata = { notes: data.notes };
      
      const { data: client, error } = await supabase
        .from("clients")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return client as Client;
    },
    onSuccess: (client) => {
      invalidateKeys.clients(queryClient);
      logCrud("update", "client", client.id, { name: client.name });
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update client",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, id) => {
      invalidateKeys.clients(queryClient);
      logCrud("delete", "client", id);
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete client",
        variant: "destructive",
      });
    },
  });
}

export interface ClientStats {
  totalClients: number;
  activeProjects: number;
  lifetimeValue: number;
  avgProjectValue: number;
}

/** Stats for clients list: by status (all vs active). Used for metric cards on /clients and /clients?status=active */
export function useClientStats(statusFilter?: string) {
  return useQuery({
    queryKey: queryKeys.clients.stats([statusFilter ?? "all"]),
    queryFn: async (): Promise<ClientStats> => {
      let clientQuery = supabase.from("clients").select("id");
      if (statusFilter) {
        clientQuery = clientQuery.eq("status", statusFilter);
      }
      const { data: clientsData, error: clientsError } = await clientQuery;
      if (clientsError) throw clientsError;
      const clientIds = (clientsData ?? []).map((r) => r.id);
      const totalClients = clientIds.length;

      if (clientIds.length === 0) {
        return { totalClients: 0, activeProjects: 0, lifetimeValue: 0, avgProjectValue: 0 };
      }

      const [projectsRes, dealsRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, budget")
          .in("client_id", clientIds)
          .eq("is_archived", false),
        supabase.from("deals").select("value").in("client_id", clientIds),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (dealsRes.error) throw dealsRes.error;

      const projects = (projectsRes.data ?? []) as { id: string; budget: number | null }[];
      const deals = (dealsRes.data ?? []) as { value: number | null }[];

      const activeProjects = projects.length;
      const lifetimeValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
      const totalBudget = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      const avgProjectValue = activeProjects > 0 ? totalBudget / activeProjects : 0;

      return {
        totalClients,
        activeProjects,
        lifetimeValue,
        avgProjectValue,
      };
    },
  });
}

// Helper to extract notes from client metadata
export function getClientNotes(client: Client): string {
  if (client.metadata && typeof client.metadata === 'object' && 'notes' in client.metadata) {
    return String(client.metadata.notes) || '';
  }
  return '';
}
