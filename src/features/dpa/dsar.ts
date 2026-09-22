import type { DsarStatus } from "@/services/dsarService";

/** Mirrors DpaServiceImpl.updateDsarStatus: COMPLETED and REJECTED are final. */
export const isDsarClosed = (status?: string): boolean => status === "COMPLETED" || status === "REJECTED";

/** Statuses an open request can move to. */
export function dsarNextStatuses(status?: string): DsarStatus[] {
  if (isDsarClosed(status)) return [];
  const all: DsarStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"];
  return all.filter((s) => s !== (status ?? "PENDING"));
}
