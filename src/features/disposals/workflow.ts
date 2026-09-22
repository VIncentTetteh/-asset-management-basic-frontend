import type { DisposalRecord, DisposalsDto } from "@/types";
import { optionalNumber, optionalString } from "@/features/finance/payloads";
import type { DisposalFilterParams } from "@/services/disposalService";

export type DisposalAction = "approve" | "reject" | "edit" | "delete";

/** compliance_document_url is VARCHAR(255). */
export const DISPOSAL_DOC_MAX_LENGTH = 255;

/** Rows written before the maker-checker workflow have no status and were effective at once. */
export const disposalStatusOf = (d: Pick<DisposalRecord, "status">) => d.status ?? "APPROVED";

/**
 * Row actions per disposal status, mirroring DisposalServiceImpl:
 *   PENDING_APPROVAL -approve (not by the requester)-> APPROVED (asset disposed)
 *   PENDING_APPROVAL -reject-> REJECTED
 * An approved disposal can be edited (notes only — its terms are locked) but not
 * deleted; a rejected one is closed and can only be deleted.
 */
export function disposalActionsFor(d: Pick<DisposalRecord, "status" | "requestedById">, currentUserId?: string): DisposalAction[] {
  switch (disposalStatusOf(d)) {
    case "PENDING_APPROVAL": {
      const own = !!currentUserId && d.requestedById === currentUserId;
      return own ? ["reject", "edit", "delete"] : ["approve", "reject", "edit", "delete"];
    }
    case "APPROVED":
      return ["edit"];
    default:
      return ["delete"];
  }
}

/** Method, date, sale value and currency are locked once a disposal is approved. */
export const disposalTermsLocked = (d: Pick<DisposalRecord, "status"> | null | undefined): boolean =>
  !!d && disposalStatusOf(d) === "APPROVED";

export interface DisposalForm {
  assetId: string;
  disposalMethod: string;
  disposalDate: string;
  saleValue?: string | number | null;
  currency?: string;
  reason?: string;
  complianceDocumentUrl?: string;
}

/**
 * Full body for POST and PUT /disposals. Edits are PUTs, so a cleared optional
 * field is sent as null. For an approved disposal the locked terms are taken from
 * the record itself, so saving notes can never trip the API's lock.
 */
export function buildDisposalPayload(form: DisposalForm, approved?: DisposalRecord | null): DisposalsDto {
  const locked = disposalTermsLocked(approved);
  return {
    assetId: form.assetId,
    disposalMethod: locked ? approved!.disposalMethod : form.disposalMethod,
    disposalDate: locked ? approved!.disposalDate : form.disposalDate,
    saleValue: locked ? approved!.saleValue ?? null : optionalNumber(form.saleValue),
    // Empty = the asset's own currency (the API fills it in).
    currency: locked ? approved!.currency ?? null : optionalString(form.currency),
    reason: optionalString(form.reason),
    complianceDocumentUrl: optionalString(form.complianceDocumentUrl),
  };
}

/** The list's filter bar: status ("" = any) and a disposal-date range. */
export interface DisposalFilters {
  status: "" | NonNullable<DisposalFilterParams["status"]>;
  startDate: string;
  endDate: string;
}

export const EMPTY_DISPOSAL_FILTERS: DisposalFilters = { status: "", startDate: "", endDate: "" };

export const DISPOSAL_STATUS_FILTERS: { value: DisposalFilters["status"]; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PENDING_APPROVAL", label: "Awaiting approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

/** GET /disposals params: blank filters omitted, the rest combined by the API. */
export function disposalQueryParams(filters: DisposalFilters): DisposalFilterParams {
  const params: DisposalFilterParams = {};
  if (filters.status) params.status = filters.status;
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;
  return params;
}

/** A compliance reference that is a link opens in a new tab; anything else is shown as text. */
export const isDocumentLink = (value?: string | null): boolean => !!value && /^https?:\/\//i.test(value.trim());
