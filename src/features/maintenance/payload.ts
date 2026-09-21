import type { Asset, MaintenanceDto } from "@/types";
import { optionalNumber, optionalString } from "@/features/finance/payloads";

/** Form values as react-hook-form holds them (inputs give strings). */
export interface MaintenanceForm {
  assetId: string;
  maintenanceType: string;
  status?: string;
  description?: string;
  scheduledDate?: string;
  performedDate?: string;
  nextDueDate?: string;
  cost?: string | number | null;
  currency?: string;
  vendorId?: string;
}

/**
 * Full body for POST and PUT /maintenance. Edits are PUTs, which replace every
 * field: a blank input is sent as null so it can be cleared (the old PATCH diff
 * dropped blanks, so a vendor or completion date could never be removed).
 */
export function buildMaintenancePayload(form: MaintenanceForm): MaintenanceDto {
  return {
    assetId: form.assetId,
    maintenanceType: form.maintenanceType,
    status: optionalString(form.status) ?? undefined,
    description: optionalString(form.description),
    scheduledDate: optionalString(form.scheduledDate),
    performedDate: optionalString(form.performedDate),
    nextDueDate: optionalString(form.nextDueDate),
    cost: optionalNumber(form.cost),
    currency: optionalString(form.currency),
    vendorId: optionalString(form.vendorId),
  };
}

/** Maintenance costs default to the currency the asset is valued in. */
export function defaultMaintenanceCurrency(asset: Pick<Asset, "currency"> | undefined, baseCurrency: string): string {
  return asset?.currency || baseCurrency;
}

/** Only open work can be marked done (the API rejects COMPLETED/CANCELLED). */
export const canCompleteMaintenance = (status?: string): boolean =>
  !status || status === "SCHEDULED" || status === "IN_PROGRESS";
