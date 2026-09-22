import type { CheckInDto, CheckoutRecordDto } from "@/services/checkoutService";
import { optionalString } from "@/features/finance/payloads";

import { FIELD_LIMITS } from "@/lib/field-limits";

/** Both condition columns are VARCHAR(50) on the API. */
export const CONDITION_MAX_LENGTH = FIELD_LIMITS.checkout.conditionOnCheckout.maxLength;
/** Checkout and return notes: @Size(max = 2000). */
export const NOTES_MAX_LENGTH = FIELD_LIMITS.checkout.notes.maxLength;

/** Who an asset is issued to: a user account, or an employee without a login. */
export type CheckoutRecipient = { kind: "user"; id: string } | { kind: "employee"; id: string };

/** The recipient picked on the check-out form. */
export function checkoutRecipient(form: { recipientType?: string; userId?: string; employeeId?: string }): CheckoutRecipient {
  return form.recipientType === "employee"
    ? { kind: "employee", id: form.employeeId ?? "" }
    : { kind: "user", id: form.userId ?? "" };
}

/**
 * Check-out body. Blank inputs are omitted rather than sent as "" (an empty
 * date string is not a date).
 */
export function buildCheckOutPayload(form: {
  expectedReturnDate?: string;
  conditionOnCheckout?: string;
  notes?: string;
}): Partial<CheckoutRecordDto> {
  return {
    expectedReturnDate: optionalString(form.expectedReturnDate) ?? undefined,
    conditionOnCheckout: optionalString(form.conditionOnCheckout) ?? undefined,
    notes: optionalString(form.notes) ?? undefined,
  };
}

/** Check-in body; the API appends the notes to the record as return notes. */
export function buildCheckInPayload(form: CheckInDto): CheckInDto {
  return {
    conditionOnReturn: optionalString(form.conditionOnReturn) ?? undefined,
    notes: optionalString(form.notes) ?? undefined,
  };
}
