import type { DsarDto, DsarStatus, DsarStatusUpdate } from "@/services/dsarService";

/** Mirrors DpaServiceImpl.updateDsarStatus: COMPLETED and REJECTED are final. */
export const isDsarClosed = (status?: string): boolean => status === "COMPLETED" || status === "REJECTED";

/** Statuses an open request can move to. */
export function dsarNextStatuses(status?: string): DsarStatus[] {
  if (isDsarClosed(status)) return [];
  const all: DsarStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"];
  return all.filter((s) => s !== (status ?? "PENDING"));
}

/** The DSAR update dialog's values. */
export interface DsarUpdateForm {
  status: string;
  responseSummary?: string;
  assignedToUserId?: string;
}

/**
 * PATCH body for a DSAR update. The summary is always sent (blank clears it),
 * and emptying the assignee picker removes the assignee.
 */
export function buildDsarStatusUpdate(form: DsarUpdateForm, original: Pick<DsarDto, "assignedToUserId">): DsarStatusUpdate {
  const update: DsarStatusUpdate = {
    status: form.status,
    responseSummary: (form.responseSummary ?? "").trim(),
  };
  if (form.assignedToUserId) {
    update.assignedToUserId = form.assignedToUserId;
  } else if (original.assignedToUserId) {
    update.clearAssignee = true;
  }
  return update;
}
