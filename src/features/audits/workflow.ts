import { AuditDiscrepancyType, AuditStatus, type AssetAuditDto } from "@/types";

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

// ── Count sheet ───────────────────────────────────────────────────────────────

/** An audit's progress through its count sheet, in the shape the UI renders. */
export interface AuditProgress {
  total: number;
  verified: number;
  discrepancies: number;
  pending: number;
  /** 0–100, rounded; 0 when the sheet is empty. */
  percent: number;
  /** True only when the sheet exists and every item on it is verified. */
  allVerified: boolean;
}

/**
 * Reads the counters the API puts on the audit.
 *
 * <p>`allVerified` is taken from the server's own `allItemsVerified` when it is
 * present rather than recomputed, so the seal and the API cannot disagree; the
 * local fallback covers a response from an older backend, where an audit with no
 * sheet is — correctly — not verified.
 */
export function auditProgressOf(audit: {
  totalItemCount?: number;
  verifiedItemCount?: number;
  discrepancyCount?: number;
  allItemsVerified?: boolean;
}): AuditProgress {
  const total = Math.max(0, audit.totalItemCount ?? 0);
  const verified = Math.max(0, Math.min(total, audit.verifiedItemCount ?? 0));
  const discrepancies = Math.max(0, Math.min(total, audit.discrepancyCount ?? 0));
  return {
    total,
    verified,
    discrepancies,
    pending: Math.max(0, total - verified - discrepancies),
    percent: total === 0 ? 0 : Math.round((verified / total) * 100),
    allVerified: audit.allItemsVerified ?? (total > 0 && verified === total),
  };
}

/** "12 / 40 verified · 3 discrepancies", or the empty-sheet wording. */
export function auditProgressLabel(progress: AuditProgress): string {
  if (progress.total === 0) return "No count sheet yet";
  const base = `${progress.verified} / ${progress.total} verified`;
  return progress.discrepancies > 0
    ? `${base} · ${progress.discrepancies} ${progress.discrepancies === 1 ? "discrepancy" : "discrepancies"}`
    : base;
}

/** The discrepancy types the API accepts, in the order the form offers them. */
export const DISCREPANCY_TYPES: readonly { value: AuditDiscrepancyType; label: string }[] = [
  { value: AuditDiscrepancyType.MISSING, label: "Missing — not found anywhere" },
  { value: AuditDiscrepancyType.WRONG_LOCATION, label: "Wrong location — found somewhere else" },
  { value: AuditDiscrepancyType.DAMAGED, label: "Damaged — found, but not serviceable" },
  { value: AuditDiscrepancyType.UNEXPECTED, label: "Unexpected — not on the count sheet" },
];

/**
 * Whether the count sheet can still be written to. COMPLETED and CANCELLED
 * audits are closed compliance records and the API refuses their items.
 */
export function canCountItems(status?: string | null): boolean {
  return !isAuditFinal(auditStatusOf({ status }));
}
