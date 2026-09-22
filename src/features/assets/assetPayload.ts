import { AssetStatus, CLEARABLE_ASSET_FIELDS, DepreciationMethod, type Asset, type AssetDto, type ClearableAssetField } from "@/types";
import { buildPatchPayload } from "@/lib/patch";

const NUMERIC_FIELDS = [
  "purchaseCost", "usefulLifeMonths", "residualValue", "insurancePremiumPerYear", "downtimeCostPerDay",
] as const;

/**
 * Normalise raw form values into an API payload: numeric inputs become numbers,
 * and empty strings are dropped (the API treats a missing field as "no value" on
 * create and "unchanged" on update).
 */
export function normaliseAssetForm(form: AssetDto): AssetDto {
  const out: Record<string, unknown> = { ...form };
  for (const key of NUMERIC_FIELDS) {
    const raw = out[key];
    if (raw === "" || raw === null || raw === undefined) {
      delete out[key];
    } else {
      const n = Number(raw);
      if (Number.isNaN(n)) delete out[key];
      else out[key] = n;
    }
  }
  for (const key of Object.keys(out)) {
    if (out[key] === "") delete out[key];
  }
  return out as unknown as AssetDto;
}

/**
 * Build a PATCH body for an edited asset: only changed fields, plus `clearFields`
 * for every optional field the user emptied (relations, identifiers, dates, cost,
 * procurement fields, depreciation overrides). A field is only cleared when the
 * form value is explicitly empty and the asset had a value, so a field the user
 * never touched (e.g. a purchase order missing from the dropdown) is kept.
 */
export function buildAssetUpdate(original: Asset, form: AssetDto): Partial<AssetDto> {
  const patch = buildPatchPayload<AssetDto>(
    original as unknown as Partial<AssetDto>,
    normaliseAssetForm(form),
  );
  // A stored 0 premium counts as a value, so only null/undefined/"" mean "nothing to clear".
  const clearFields: ClearableAssetField[] = CLEARABLE_ASSET_FIELDS.filter(
    (field) => form[field] === "" && original[field] != null && original[field] !== "",
  );
  if (clearFields.length > 0) patch.clearFields = clearFields;
  return patch;
}

/**
 * Statuses the edit form offers. DISPOSED is reached only through an approved
 * disposal request, and a disposed asset's status is final: the API refuses
 * both through create/edit.
 */
export function editableAssetStatuses(current?: string | null): string[] {
  if (current === AssetStatus.DISPOSED) return [AssetStatus.DISPOSED];
  return Object.values(AssetStatus).filter((s) => s !== AssetStatus.DISPOSED);
}

/** The register's "Book value": net book value from the depreciation engine, else cost. */
export function assetBookValue(asset: Pick<Asset, "currentBookValue" | "purchaseCost">): number | undefined {
  return asset.currentBookValue ?? asset.purchaseCost;
}

/**
 * Depreciation methods the asset form offers. UNITS_OF_PRODUCTION is left out:
 * assets record no usage, so the engine applies it as straight-line. An asset
 * that already has it keeps it selectable so an unrelated edit does not change it.
 */
export function assetDepreciationMethods(current?: string | null): string[] {
  return Object.values(DepreciationMethod).filter(
    (m) => m !== DepreciationMethod.UNITS_OF_PRODUCTION || current === m,
  );
}

/** Mirrors the API: a residual value may not exceed the purchase cost (either blank passes). */
export function residualWithinCost(residual: unknown, cost: unknown): boolean {
  const blank = (v: unknown) => v === "" || v === null || v === undefined;
  if (blank(residual) || blank(cost)) return true;
  const r = Number(residual);
  const c = Number(cost);
  return Number.isNaN(r) || Number.isNaN(c) || r <= c;
}
