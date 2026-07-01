import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CsaDateRange } from "@/lib/csaDateRange";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import {
  createCsaIngestToken,
  fetchCsaIngestTokens,
  fetchCsaReportsList,
  fetchCsaTeamSummary,
  fetchCsaUserDetail,
  generateCsaInsights,
  revokeCsaIngestToken,
} from "@/lib/api/csaReportsService";

export function useCsaTeamSummary(period: CsaDateRange) {
  return useQuery({
    queryKey: queryKeys.csa.teamSummary(period.period_start, period.period_end),
    queryFn: () => fetchCsaTeamSummary(period),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useCsaReportsList(period: CsaDateRange) {
  return useQuery({
    queryKey: queryKeys.csa.reportsList(period.period_start, period.period_end),
    queryFn: () => fetchCsaReportsList(period),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useCsaUserDetail(userId: string | null, period: CsaDateRange) {
  return useQuery({
    queryKey: queryKeys.csa.userDetail(userId ?? "", period.period_start, period.period_end),
    queryFn: () => fetchCsaUserDetail(userId!, period),
    enabled: !!userId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useCsaIngestTokens() {
  return useQuery({
    queryKey: queryKeys.csa.ingestTokens,
    queryFn: fetchCsaIngestTokens,
  });
}

export function useCreateCsaIngestToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (label?: string) => createCsaIngestToken(label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.csa.ingestTokens });
    },
  });
}

export function useRevokeCsaIngestToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tokenId: string) => revokeCsaIngestToken(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.csa.ingestTokens });
    },
  });
}

export function useGenerateCsaInsights() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options?: { userId?: string; period?: CsaDateRange }) => generateCsaInsights(options),
    onSuccess: () => {
      invalidateKeys.csa(queryClient);
    },
  });
}
