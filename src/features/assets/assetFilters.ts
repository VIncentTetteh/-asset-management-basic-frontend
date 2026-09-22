import type { SortingState } from "@tanstack/react-table";
import type { AssetFilterParams } from "@/services/assetService";

/** URL-backed register filters (every value is the raw search param, "" when unset). */
export interface AssetFilters {
  status: string;
  condition: string;
  assetType: string;
  categoryId: string;
  departmentId: string;
  locationId: string;
  purchaseDateFrom: string;
  purchaseDateTo: string;
  warrantyExpiryBefore: string;
  assigned: string;
  page: number;
  sort: string;
}

/** Filters under "advanced", cleared together by "Clear filters". */
export const ADVANCED_FILTER_KEYS = [
  "condition", "assetType", "categoryId", "departmentId", "locationId",
  "purchaseDateFrom", "purchaseDateTo", "warrantyExpiryBefore", "assigned",
] as const satisfies readonly (keyof AssetFilters)[];

export const DEFAULT_ASSET_SORT = "name,asc";

/** Read the register filters from the URL. */
export function readAssetFilters(get: (key: string) => string | null): AssetFilters {
  const value = (key: string) => get(key) ?? "";
  return {
    status: get("status") ?? "ALL",
    condition: value("condition"),
    assetType: value("assetType"),
    categoryId: value("categoryId"),
    departmentId: value("departmentId"),
    locationId: value("locationId"),
    purchaseDateFrom: value("purchaseDateFrom"),
    purchaseDateTo: value("purchaseDateTo"),
    warrantyExpiryBefore: value("warrantyExpiryBefore"),
    assigned: value("assigned"),
    page: Number(get("page") ?? "0"),
    sort: get("sort") ?? DEFAULT_ASSET_SORT,
  };
}

export function hasAdvancedAssetFilters(filters: AssetFilters): boolean {
  return ADVANCED_FILTER_KEYS.some((key) => Boolean(filters[key]));
}

/** GET /assets query parameters; blank filters are omitted, all present ones combine (AND). */
export function assetQueryParams(filters: AssetFilters, search: string, size = 20): AssetFilterParams {
  const optional = (v: string) => v || undefined;
  return {
    search: optional(search),
    status: filters.status !== "ALL" ? optional(filters.status) : undefined,
    condition: optional(filters.condition),
    assetType: optional(filters.assetType),
    categoryId: optional(filters.categoryId),
    departmentId: optional(filters.departmentId),
    locationId: optional(filters.locationId),
    purchaseDateFrom: optional(filters.purchaseDateFrom),
    purchaseDateTo: optional(filters.purchaseDateTo),
    warrantyExpiryBefore: optional(filters.warrantyExpiryBefore),
    assigned: filters.assigned === "true" ? true : filters.assigned === "false" ? false : undefined,
    page: filters.page,
    size,
    sort: filters.sort,
  };
}

/**
 * Table column id → API sort field. Only these columns sort, and they sort
 * server-side across the whole register (not just the loaded page).
 */
export const ASSET_SORT_FIELDS: Readonly<Record<string, string>> = {
  name: "name",
  assetTag: "assetTag",
  bookValue: "currentBookValue",
  status: "status",
};

/** The `sort` param ("field,dir") as table sorting state. */
export function sortParamToState(sort: string): SortingState {
  const [field, dir] = sort.split(",");
  const column = Object.keys(ASSET_SORT_FIELDS).find((id) => ASSET_SORT_FIELDS[id] === field);
  return column ? [{ id: column, desc: dir === "desc" }] : [];
}

/** Table sorting state as the `sort` param; no sort falls back to the default. */
export function sortStateToParam(state: SortingState): string {
  const first = state[0];
  const field = first ? ASSET_SORT_FIELDS[first.id] : undefined;
  return field ? `${field},${first.desc ? "desc" : "asc"}` : DEFAULT_ASSET_SORT;
}
