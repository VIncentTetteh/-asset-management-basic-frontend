import { AuditStatus, type AssetAuditDto } from "@/types";

/**
 * Allowed audit status changes, mirroring AuditServiceImpl.TRANSITIONS (the API
 * answers 409 for anything else). COMPLETED and CANCELLED are final.
 */
const TRANSITIONS: Record<string, AuditStatus[]> = {
  [AuditStatus.PLANNED]: [AuditStatus.IN_PROGRESS, AuditStatus.COMPLETED, AuditStatus.DISCREPANCY_FOUND, AuditStatus.CANCELLED],
  [AuditStatus.IN_PROGRESS]: [AuditStatus.COMPLETED, AuditStatus.DISCREPANCY_FOUND, AuditStatus.CANCELLED],
  [AuditStatus.DISCREPANCY_FOUND]: [AuditStatus.RESOLVED, AuditStatus.IN_PROGRESS],
  [AuditStatus.RESOLVED]: [AuditStatus.COMPLETED],
  [AuditStatus.COMPLETED]: [],
  [AuditStatus.CANCELLED]: [],
};

/** Statuses an audit can move to next (not including staying put). */
export const nextAuditStatuses = (current?: string): AuditStatus[] =>
  TRANSITIONS[current ?? AuditStatus.PLANNED] ?? [];

export const isAuditFinal = (status?: string): boolean => nextAuditStatuses(status).length === 0;

/** Statuses a new audit may start in (the API refuses any other). */
export const INITIAL_AUDIT_STATUSES = [AuditStatus.PLANNED, AuditStatus.IN_PROGRESS] as const;

/** An audit's status; legacy rows without one read as PLANNED, as the API does. */
export const auditStatusOf = (audit: { status?: string | null } | null | undefined): AuditStatus =>
  (audit?.status as AuditStatus | undefined) || AuditStatus.PLANNED;

/** Status options for the form: a new audit's initial statuses, or the current one and its next steps. */
export function auditStatusOptions(editing: { status?: string | null } | null | undefined): AuditStatus[] {
  if (!editing) return [...INITIAL_AUDIT_STATUSES];
  const current = auditStatusOf(editing);
  return [current, ...nextAuditStatuses(current)];
}

export interface AuditForm {
  auditDate: string;
  departmentId?: string;
  conductedById?: string;
  status?: string;
  remarks?: string;
}

/**
 * POST /audits body. The organisation comes from the session; no department
 * means an organisation-wide audit; no auditor means the current user.
 */
export function buildAuditPayload(form: AuditForm): Partial<AssetAuditDto> {
  return {
    auditDate: form.auditDate,
    departmentId: form.departmentId || undefined,
    conductedById: form.conductedById || undefined,
    status: (INITIAL_AUDIT_STATUSES as readonly string[]).includes(form.status ?? "") ? form.status : AuditStatus.PLANNED,
    remarks: form.remarks?.trim() || undefined,
  };
}
