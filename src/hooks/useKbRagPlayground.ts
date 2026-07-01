import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { toast } from "sonner";
import type { RagPlaygroundResult } from "@/types/knowledgeRag";

export function useKbRagPlayground() {
  return useMutation({
    mutationFn: async (input: {
      query: string;
      source_id?: string;
      match_threshold?: number;
      match_count?: number;
      generate_answer?: boolean;
      save_run?: boolean;
      save_test_case?: boolean;
      expected_answer?: string;
    }): Promise<RagPlaygroundResult> => {
      const { data, error } = await supabase.functions.invoke("kb-rag-playground", { body: input });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as RagPlaygroundResult;
    },
  });
}

export function useKbEvalTestCases() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { question: string; expected_answer?: string; run_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("kb_eval_test_cases").insert({
        ...input,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.ragPlayground });
      toast.success("Test case saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
