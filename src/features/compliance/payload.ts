/**
 * Form → API body for the compliance CRUD screens.
 *
 * Every compliance date on the API is a java.time.Instant, which Jackson only
 * reads from a full ISO timestamp: the bare "2026-09-30" a date input yields was
 * rejected as malformed JSON, so any record with a date (and every regulatory
 * filing and vulnerability scan, whose date is required) failed to save. Dates
 * are sent as midday UTC so the calendar day survives display in any timezone
 * from UTC-11 to UTC+11.
 */

/** "attachment" is a document-uploader field whose column still holds a legacy URL string. */
export type ComplianceFieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "attachment";

export interface PayloadField {
  name: string;
  type: ComplianceFieldType;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-09-30" → "2026-09-30T12:00:00Z"; anything else is returned unchanged. */
export const dateToInstant = (value: string): string => (DATE_ONLY.test(value) ? `${value}T12:00:00Z` : value);

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/**
 * Converts form values for the API. Blank values are omitted (the PATCH
 * endpoints treat a missing field as unchanged) — except text fields that had a
 * value on the record being edited, which are sent as "" so they can be cleared.
 * Numbers are coerced from input strings and dates become instants.
 */
export function buildCompliancePayload(
  fields: PayloadField[],
  data: Record<string, unknown>,
  editing?: Record<string, unknown> | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const byName = new Map(fields.map((f) => [f.name, f]));
  for (const [key, raw] of Object.entries(data)) {
    const field = byName.get(key);
    if (isBlank(raw)) {
      const wasSet = editing != null && !isBlank(editing[key]);
      if (wasSet && field && (field.type === "text" || field.type === "textarea" || field.type === "attachment")) out[key] = "";
      continue;
    }
    if (field?.type === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) out[key] = n;
    } else if (field?.type === "date") {
      out[key] = dateToInstant(String(raw));
    } else if (typeof raw === "string") {
      out[key] = raw.trim();
    } else {
      out[key] = raw;
    }
  }
  return out;
}

/**
 * Full-replace body for PUT /compliance/{register}/{id}: every form field is sent,
 * and a blank one as null, which the API reads as "clear it" (dates, numbers,
 * selects and owners included; PATCH could not clear those). Checkboxes are
 * booleans; numbers are coerced; dates become instants. `fixed` values (e.g. the
 * asset an ICS record belongs to, which cannot change) override the form.
 */
export function buildComplianceReplacePayload(
  fields: PayloadField[],
  data: Record<string, unknown>,
  fixed: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = data[field.name];
    if (field.type === "checkbox") {
      out[field.name] = Boolean(raw);
    } else if (isBlank(raw)) {
      out[field.name] = null;
    } else if (field.type === "number") {
      const n = Number(raw);
      out[field.name] = Number.isFinite(n) ? n : null;
    } else if (field.type === "date") {
      out[field.name] = dateToInstant(String(raw));
    } else if (typeof raw === "string") {
      out[field.name] = raw.trim();
    } else {
      out[field.name] = raw;
    }
  }
  return { ...out, ...fixed };
}

/**
 * Body of POST /compliance/bog/controls (an upsert by directive ref). The target
 * date goes as an instant (a bare date used to be dropped silently by the API),
 * and blank optional text or date is sent as null so an edit can clear it.
 */
export function buildBogControlPayload(form: {
  directiveRef?: string;
  requirement?: string;
  status?: string;
  gapDescription?: string | null;
  remediationPlan?: string | null;
  targetDate?: string | null;
  evidenceUrl?: string | null;
}) {
  const text = (v: unknown): string | null => (isBlank(v) ? null : String(v).trim());
  return {
    directiveRef: String(form.directiveRef ?? "").trim(),
    requirement: String(form.requirement ?? "").trim(),
    status: form.status || undefined,
    gapDescription: text(form.gapDescription),
    remediationPlan: text(form.remediationPlan),
    evidenceUrl: text(form.evidenceUrl),
    targetDate: isBlank(form.targetDate) ? null : dateToInstant(String(form.targetDate)),
  };
}
