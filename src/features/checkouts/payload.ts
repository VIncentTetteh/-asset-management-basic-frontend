import type { CheckInDto, CheckoutRecordDto } from "@/services/checkoutService";
import { optionalString } from "@/features/finance/payloads";

/** Both condition columns are VARCHAR(50) on the API. */
export const CONDITION_MAX_LENGTH = 50;

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
