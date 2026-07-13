import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient. Defaults tuned for an enterprise CRUD app:
 * - 30s staleTime — list pages feel instant when navigating back, while
 *   edits still show promptly (mutations invalidate their keys anyway).
 * - No refetch on window focus: users keep AssetIQ open all day; focus
 *   refetches would hammer the API without changing what they see.
 * - One retry: the axios layer already handles 401 refresh; retrying more
 *   masks real outages.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Query-key factory. One place to name keys so invalidation is greppable:
 * qk.assets.list({ page: 0 }) / queryClient.invalidateQueries({ queryKey: qk.assets.all })
 */
export const qk = {
  assets: {
    all: ["assets"] as const,
    list: (params?: unknown) => ["assets", "list", params] as const,
    detail: (id: string) => ["assets", "detail", id] as const,
  },
  employees: {
    all: ["employees"] as const,
    list: (params?: unknown) => ["employees", "list", params] as const,
    detail: (id: string) => ["employees", "detail", id] as const,
    assets: (id: string) => ["employees", "detail", id, "assets"] as const,
    checklists: (id: string) => ["employees", "detail", id, "checklists"] as const,
  },
  checkouts: {
    all: ["checkouts"] as const,
    list: () => ["checkouts", "list"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
  },
  /** Generic helper for modules without bespoke keys yet. */
  module: (name: string) => ({
    all: [name] as const,
    list: (params?: unknown) => [name, "list", params] as const,
    detail: (id: string) => [name, "detail", id] as const,
  }),
};
