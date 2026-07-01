import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  client_id: string | null;
  meeting_id: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  // Joined data
  clients?: { name: string } | null;
  meetings?: { title: string } | null;
  assigned_user?: { full_name: string; email: string } | null;
}

export interface TaskFormData {
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  assigned_to?: string;
  client_id?: string;
  meeting_id?: string;
}

export function useTasks(filters?: Record<string, any>) {
  return useQuery({
    queryKey: ["tasks", "list", filters],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          clients(name),
          meetings(title)
        `)
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.priority) {
        query = query.eq("priority", filters.priority);
      }

      if (filters?.assigned_to) {
        query = query.eq("assigned_to", filters.assigned_to);
      }

      if (filters?.client_id) {
        query = query.eq("client_id", filters.client_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["tasks", "detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          clients(name),
          meetings(title)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Task & {
        creator?: { full_name: string; email: string } | null;
      };
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: TaskFormData) => {
      const insertData = {
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || null,
        assigned_to: data.assigned_to || null,
        client_id: data.client_id || null,
        meeting_id: data.meeting_id || null,
        created_by: user?.id!,
      };

      const { data: task, error } = await supabase
        .from("tasks")
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return task as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskFormData> }) => {
      const { data: task, error } = await supabase
        .from("tasks")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return task as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task",
        variant: "destructive",
      });
    },
  });
}
