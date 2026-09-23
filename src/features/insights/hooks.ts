"use client";

import { useQuery } from "@tanstack/react-query";
import {
    operationsAnalyticsService,
    type ExpiryParams,
    type SpendParams,
    type WasteParams,
} from "@/services/operationsAnalyticsService";
import type { EstateDimension } from "@/features/insights/types";

/**
 * One query per surface, each keyed on its own parameters so switching the
 * grouping or the horizon refetches instead of showing the previous answer
 * under a new heading.
 *
 * These are live figures a manager acts on, so the window is short: a minute of
 * staleness is fine for navigating back and forth, longer is not.
 */
const STALE_MS = 60_000;

export const insightKeys = {
    all: ["operations-analytics"] as const,
    estate: (groupBy: EstateDimension) => ["operations-analytics", "estate", groupBy] as const,
    waste: (params: WasteParams) => ["operations-analytics", "cost-waste", params] as const,
    expiring: (params: ExpiryParams) => ["operations-analytics", "expiring", params] as const,
    spend: (params: SpendParams) => ["operations-analytics", "spend", params] as const,
    trends: (days: number) => ["operations-analytics", "trends", days] as const,
};

export function useEstateInsight(groupBy: EstateDimension) {
    return useQuery({
        queryKey: insightKeys.estate(groupBy),
        queryFn: () => operationsAnalyticsService.getEstate(groupBy),
        staleTime: STALE_MS,
    });
}

export function useWasteInsight(params: WasteParams) {
    return useQuery({
        queryKey: insightKeys.waste(params),
        queryFn: () => operationsAnalyticsService.getCostWaste(params),
        staleTime: STALE_MS,
    });
}

export function useExpiryInsight(params: ExpiryParams) {
    return useQuery({
        queryKey: insightKeys.expiring(params),
        queryFn: () => operationsAnalyticsService.getExpiring(params),
        staleTime: STALE_MS,
    });
}

export function useSpendInsight(params: SpendParams) {
    return useQuery({
        queryKey: insightKeys.spend(params),
        queryFn: () => operationsAnalyticsService.getSpend(params),
        staleTime: STALE_MS,
    });
}

export function useTrendsInsight(days: number) {
    return useQuery({
        queryKey: insightKeys.trends(days),
        queryFn: () => operationsAnalyticsService.getTrends(days),
        staleTime: STALE_MS,
    });
}
