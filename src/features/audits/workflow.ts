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

/** The audits list filter bar ("" = any). */
export interface AuditFilters {
  status: string;
  departmentId: string;
  startDate: string;
  endDate: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = { status: "", departmentId: "", startDate: "", endDate: "" };

/** GET /audits params: blank filters omitted, the rest combined by the API. */
export function auditQueryParams(filters: AuditFilters): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => Boolean(v)));
}

/**
 * The audit's scope: organisation-wide only when it has no department. A
 * department the viewer's list does not contain still shows by the API's name.
 */
export function auditScopeLabel(audit: { departmentId?: string | null; departmentName?: string | null }, lookup?: (id: string) => string | undefined): string {
  if (!audit.departmentId) return "Whole organisation";
  return audit.departmentName || lookup?.(audit.departmentId) || "Unknown department";
}

/**
 * What saving the edit dialog changes: the remarks (PATCH /audits/{id}) and/or
 * the status (PATCH /status). A final audit changes neither.
 */
export function auditEditChanges(
  audit: { status?: string | null; remarks?: string | null },
  form: { status?: string; remarks?: string },
): { remarks?: string | null; status?: AuditStatus } {
  const changes: { remarks?: string | null; status?: AuditStatus } = {};
  if (isAuditFinal(auditStatusOf(audit))) return changes;
  const nextRemarks = form.remarks?.trim() ?? "";
  if (nextRemarks !== (audit.remarks ?? "").trim()) changes.remarks = nextRemarks || null;
  if (form.status && form.status !== auditStatusOf(audit)) changes.status = form.status as AuditStatus;
  return changes;
}
