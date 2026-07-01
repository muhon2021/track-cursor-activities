import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { UnifiedDocument } from "@/types/knowledgeBase";

export interface UserKnowledgeFile {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  mime_type: string | null;
  processing_status: string;
  processing_error: string | null;
  chunk_count: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserKnowledgeSource {
  id: string;
  user_id: string;
  name: string;
  source_type: string;
  source_identifier: string | null;
  source_url: string | null;
  sync_enabled: boolean;
  sync_frequency: string;
  last_synced_at: string | null;
  sync_status: string;
  file_count: number;
  total_size: number;
  credentials: Record<string, unknown>;
  sync_config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useUserKnowledgeFiles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-knowledge-files', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_knowledge_files')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UserKnowledgeFile[];
    },
    enabled: !!user,
  });
}

export function useUserKnowledgeSources() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-knowledge-sources', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_knowledge_sources')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserKnowledgeSource[];
    },
    enabled: !!user,
  });
}

/** Personal documents from unified_documents (owner_type = user) */
export function useUnifiedUserDocuments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.knowledge.unifiedDocuments({ owner_type: 'user', owner_id: user?.id ?? '' }),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unified_documents')
        .select('*')
        .eq('owner_type', 'user')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as UnifiedDocument[];
    },
    enabled: !!user,
  });
}

export function useUploadUserKnowledgeFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("User not authenticated");

      const fileExt = file.name.split('.').pop();
      const storagePath = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('user-knowledge')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Create database record
      const { data, error } = await supabase
        .from('user_knowledge_files')
        .insert({
          user_id: user.id,
          title: file.name.replace(/\.[^.]+$/, ''),
          file_name: file.name,
          file_type: file.type || fileExt || null,
          file_size: file.size,
          storage_path: storagePath,
          processing_status: 'pending',
          metadata: { original_name: file.name },
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "File Uploaded",
        description: `${file.name} uploaded successfully`,
      });

      return data as UserKnowledgeFile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-knowledge-files'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.userKnowledgeStats('' ) });
    },
    onError: (error: Error) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteUserKnowledgeFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (fileId: string) => {
      // Get file info for storage cleanup
      const { data: file } = await supabase
        .from('user_knowledge_files')
        .select('storage_path')
        .eq('id', fileId)
        .maybeSingle();

      // Delete storage file if it exists
      if (file?.storage_path) {
        await supabase.storage
          .from('user-knowledge')
          .remove([file.storage_path]);
      }

      // Delete database record
      const { error } = await supabase.from('user_knowledge_files').delete().eq('id', fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-knowledge-files'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.userKnowledgeStats('') });
      toast({ title: "Success", description: "File deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteUnifiedDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from('unified_documents').delete().eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.unifiedDocuments({}) });
      toast({ title: "Success", description: "Document removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useCreateUserKnowledgeSource() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sourceData: Partial<UserKnowledgeSource>) => {
      const { data, error } = await (supabase as any)
        .from('user_knowledge_sources')
        .insert({ ...sourceData, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as UserKnowledgeSource;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-knowledge-sources'] });
      toast({ title: "Success", description: "Knowledge source created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUserKnowledgeStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.knowledge.userKnowledgeStats(user?.id ?? ''),
    queryFn: async () => {
      const [filesRes, unifiedRes] = await Promise.all([
        supabase.from('user_knowledge_files').select('id, processing_status, file_size').eq('user_id', user!.id),
        supabase.from('unified_documents').select('id, processing_status, file_size').eq('owner_type', 'user').eq('owner_id', user!.id),
      ]);
      const files = (filesRes.data ?? []) as { id: string; processing_status: string; file_size: number | null }[];
      const unified = (unifiedRes.data ?? []) as { id: string; processing_status: string; file_size: number | null }[];
      const all = [...files, ...unified];
      return {
        total_files: all.length,
        total_size: all.reduce((s, f) => s + (f.file_size ?? 0), 0),
        pending: all.filter((f) => f.processing_status === 'pending').length,
        processing: all.filter((f) => f.processing_status === 'processing').length,
        completed: all.filter((f) => f.processing_status === 'completed').length,
        failed: all.filter((f) => f.processing_status === 'failed').length,
        by_source: {} as Record<string, number>,
      };
    },
    enabled: !!user,
  });
}

export function useUserFileStats() {
  return useUserKnowledgeStats();
}

export function useProcessAllPendingFiles() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('user-knowledge-process', {
        body: { user_id: user?.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-knowledge-files'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.unifiedDocuments({}) });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.userKnowledgeStats(user?.id ?? '') });
      toast({ title: 'Processing started', description: 'Pending files are being processed.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });
}
