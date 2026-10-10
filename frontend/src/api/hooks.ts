import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import type { Dashboard, Market, MarketCreate, Report, SuggestRequest } from "../types";
import {
  createMarket,
  generateWeeklyReport,
  getDashboard,
  getLatestReport,
  getMarket,
  listMarkets,
  scanMarket,
  suggestMarket,
} from "./endpoints";

export const queryKeys = {
  markets: ["markets"] as const,
  market: (id: number) => ["market", id] as const,
  dashboard: (id: number) => ["dashboard", id] as const,
  latestReport: (id: number) => ["report", id] as const,
};

const isValidId = (id: number) => Number.isInteger(id) && id > 0;

export function useMarkets() {
  const { request } = useAuth();
  return useQuery({ queryKey: queryKeys.markets, queryFn: () => listMarkets(request) });
}

export function useMarket(id: number) {
  const { request } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.market(id),
    queryFn: () => getMarket(request, id),
    enabled: isValidId(id),
    // Show the cached list entry instantly while the single-market request runs.
    placeholderData: () => queryClient.getQueryData<Market[]>(queryKeys.markets)?.find((market) => market.id === id),
  });
}

export function useDashboard(id: number) {
  const { request } = useAuth();
  return useQuery({ queryKey: queryKeys.dashboard(id), queryFn: () => getDashboard(request, id), enabled: isValidId(id) });
}

export function useLatestReport(id: number) {
  const { request } = useAuth();
  return useQuery({ queryKey: queryKeys.latestReport(id), queryFn: () => getLatestReport(request, id), enabled: isValidId(id) });
}

export function useSuggestMarket() {
  const { request } = useAuth();
  return useMutation({ mutationFn: (body: SuggestRequest) => suggestMarket(request, body) });
}

export function useCreateMarket() {
  const { request } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: MarketCreate) => createMarket(request, body),
    onSuccess: (market) => {
      queryClient.setQueryData(queryKeys.market(market.id), market);
      queryClient.setQueryData<Market[]>(queryKeys.markets, (current) => (current ? [...current.filter((item) => item.id !== market.id), market] : current));
      void queryClient.invalidateQueries({ queryKey: queryKeys.markets, exact: true });
    },
  });
}

export function useScanMarket(id: number) {
  const { request } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => scanMarket(request, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(id) });
    },
  });
}

export function useGenerateWeeklyReport(id: number) {
  const { request } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateWeeklyReport(request, id),
    onSuccess: (report: Report) => {
      queryClient.setQueryData(queryKeys.latestReport(id), report);
      // Patch the dashboard's copy instead of refetching (a refetch would dim every panel).
      queryClient.setQueryData<Dashboard>(queryKeys.dashboard(id), (current) => (current ? { ...current, report } : current));
    },
  });
}
