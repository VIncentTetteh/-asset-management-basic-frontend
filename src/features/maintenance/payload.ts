import type { Asset, MaintenanceDto } from "@/types";
import { optionalNumber, optionalString } from "@/features/finance/payloads";
import { todayLocal } from "@/lib/local-date";

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
  const status = optionalString(form.status) ?? undefined;
  // Work recorded as done was performed today unless the form says when.
  const performedDate = optionalString(form.performedDate) ?? (status === "COMPLETED" ? todayLocal() : null);
  return {
    assetId: form.assetId,
    maintenanceType: form.maintenanceType,
    status,
    description: optionalString(form.description),
    scheduledDate: optionalString(form.scheduledDate),
    performedDate,
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

/** Assets that can take new maintenance: not disposed or retired (the API refuses those). */
export function maintainableAssets<T extends Pick<Asset, "id" | "status">>(assets: T[], currentAssetId?: string): T[] {
  return assets.filter(
    (a) => a.id === currentAssetId || (a.status !== "DISPOSED" && a.status !== "RETIRED"),
  );
}
