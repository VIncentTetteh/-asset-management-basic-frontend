import type { InsightFilter, InsightResourceType } from "@/features/insights/types";

/**
 * Turning a figure into a link to the records behind it.
 *
 * A dashboard you cannot interrogate is decoration, so every number on these
 * surfaces offers a way through to its rows. The honest part is that the
 * registers cannot express every filter the analytics can compute, and this
 * module refuses to pretend otherwise:
 *
 *   - The asset register (`/assets`) filters on the keys in
 *     {@link ASSET_REGISTER_KEYS}. Those come straight from `AssetFilterRequest`
 *     on the backend and `readAssetFilters` in the web app; a key outside that
 *     set is silently dropped by the register, which would land the user on a
 *     longer list than the number they clicked.
 *   - A filter value of `null` means "records with no value for this dimension"
 *     — a real set, and one the register has no way to ask for. `departmentId=`
 *     empty is read as "no department filter", i.e. every asset.
 *   - Licences, contracts, leases, maintenance and budgets have no URL filters
 *     at all today, so a finding about them links to the register rather than
 *     to a filtered view of it.
 *
 * {@link insightFilterLink} therefore returns not just an href but how exact it
 * is, and the surfaces render that difference in words: "View these 12 assets"
 * versus "Open the register filtered to In stock (shows more than these 12)".
 * The precise records are always reachable regardless, because every finding
 * and stream carries its own `items`.
 */

/** Filters `/assets` actually honours, from `AssetFilterRequest` / `readAssetFilters`. */
export const ASSET_REGISTER_KEYS = [
    "search",
    "status",
    "condition",
    "assetType",
    "categoryId",
    "departmentId",
    "locationId",
    "assigned",
    "purchaseDateFrom",
    "purchaseDateTo",
    "warrantyExpiryBefore",
] as const;

const ASSET_KEY_SET: ReadonlySet<string> = new Set(ASSET_REGISTER_KEYS);

/** Where each kind of record lives. */
export const REGISTER_PATHS: Readonly<Record<InsightResourceType, string>> = {
    asset: "/assets",
    licence: "/licenses",
    maintenance: "/maintenance",
    contract: "/contracts",
    lease: "/leases",
    budget: "/budgets",
};

export const REGISTER_LABELS: Readonly<Record<InsightResourceType, string>> = {
    asset: "asset register",
    licence: "software licences",
    maintenance: "maintenance records",
    contract: "contracts",
    lease: "lease records",
    budget: "budgets",
};

export type LinkExactness =
    /** The register will show exactly the records behind the number. */
    | "exact"
    /** The register honours some of the filter; it will show a superset. */
    | "broader"
    /** Nothing in the filter is expressible; the link opens the plain register. */
    | "unfiltered";

export interface InsightLink {
    href: string;
    exactness: LinkExactness;
    /** Filter keys the register cannot express, for saying so out loud. */
    droppedKeys: string[];
    /** Ready-made sentence for the link, e.g. "Open the asset register filtered to In stock". */
    label: string;
}

const HUMAN_KEYS: Readonly<Record<string, string>> = {
    status: "status",
    condition: "condition",
    assetType: "type",
    categoryId: "category",
    departmentId: "department",
    locationId: "location",
    assigned: "assignment",
    fullyDepreciated: "fully depreciated",
    underUtilised: "under-utilised seats",
    overAllocated: "over-allocated seats",
    budgetId: "budget",
};

/** "IN_STOCK" → "In stock"; a uuid is left alone. */
export function humaniseFilterValue(value: string): string {
    if (!/^[A-Z][A-Z0-9_]*$/.test(value)) return value;
    const words = value.toLowerCase().split("_");
    return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

/**
 * The link for one figure's `filter`.
 *
 * @param filter        the backend's filter object for this figure
 * @param resource      which register the records live in
 * @param fallbackLabel what to call the records, e.g. "12 assets"
 */
export function insightFilterLink(
    filter: InsightFilter | undefined,
    resource: InsightResourceType,
    fallbackLabel: string,
    /**
     * Whether the filter, applied to the register, selects *exactly* the records
     * the figure counted.
     *
     * A filter can be fully expressible and still select more: the cost-waste
     * finding "in stock and not seen for 180+ days" carries `status=IN_STOCK`,
     * which the register honours perfectly — and which shows every in-stock
     * asset, not the 24 that were counted. Callers whose rule is finer than any
     * register filter pass `"superset"`, and the link says so.
     */
    precision: "exact" | "superset" = "exact",
): InsightLink {
    const path = REGISTER_PATHS[resource];
    const entries = Object.entries(filter ?? {});
    const params = new URLSearchParams();
    const dropped: string[] = [];

    for (const [key, value] of entries) {
        const expressible = resource === "asset" && ASSET_KEY_SET.has(key) && value !== null && value !== "";
        if (expressible) params.set(key, value as string);
        else dropped.push(key);
    }

    const applied = Array.from(params.keys());
    const exactness: LinkExactness =
        entries.length > 0 && dropped.length === 0 && precision === "exact" ? "exact"
            : applied.length > 0 ? "broader"
                : "unfiltered";

    const describe = () =>
        applied
            .map((key) => `${HUMAN_KEYS[key] ?? key} ${humaniseFilterValue(params.get(key) ?? "")}`)
            .join(", ");

    const label =
        exactness === "exact" ? `View ${fallbackLabel}`
            : exactness === "broader" ? `Open the ${REGISTER_LABELS[resource]} filtered to ${describe()}`
                : `Open the ${REGISTER_LABELS[resource]}`;

    const query = params.toString();
    return { href: query ? `${path}?${query}` : path, exactness, droppedKeys: dropped, label };
}

/**
 * Why a link cannot be exact, in words the user can act on. Null when it is.
 *
 * A dropped key whose value was `null` gets its own sentence, because "records
 * with no department" is not a filter the register is missing by oversight —
 * there is no way to express it at all, and saying "cannot filter on
 * department" would send the user looking for a filter that is right there.
 */
export function explainInexactLink(
    link: InsightLink,
    resource: InsightResourceType,
    filter: InsightFilter | undefined,
    options: { recordsListed?: boolean } = {},
): string | null {
    if (link.exactness === "exact") return null;
    const register = REGISTER_LABELS[resource];
    const tail = options.recordsListed
        ? " The records counted here are listed below."
        : "";

    const unvalued = link.droppedKeys.filter((key) => (filter ?? {})[key] === null);
    if (unvalued.length > 0 && unvalued.length === link.droppedKeys.length) {
        const names = unvalued.map((key) => HUMAN_KEYS[key] ?? key);
        return `These are the records with no ${names.join(" or ")}, which the ${register} has no filter for. `
            + `This link opens the full register.${tail}`;
    }

    const names = link.droppedKeys.map((key) => HUMAN_KEYS[key] ?? key);
    if (names.length === 0 && link.exactness === "broader") {
        // Every key applied, but the rule behind the number is finer than any
        // filter the register has.
        return `The ${register} cannot express the whole rule behind this number, so this link shows a wider `
            + `list.${tail}`;
    }
    const cannot = names.length > 0
        ? `The ${register} cannot filter on ${names.join(" or ")}, `
        : `The ${register} has no filters for this, `;
    return `${cannot}so this link shows a wider list.${tail}`;
}

/**
 * A link straight to one record. Only the asset register has a deep link
 * (`/assets?id=…` opens that asset); everything else opens its register.
 */
export function insightRecordHref(resource: InsightResourceType, id: string): string {
    if (resource === "asset" && id) return `/assets?id=${encodeURIComponent(id)}`;
    return REGISTER_PATHS[resource];
}
