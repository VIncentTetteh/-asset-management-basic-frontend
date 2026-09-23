import { qk } from "@/lib/queryClient";
import type { ImportTypeSummary } from "@/services/importService";

/**
 * The entity types the wizard is wired up for.
 *
 * `GET /imports/types` is the authority on what an organisation may import —
 * this registry exists because the *client* needs two things the API does not
 * carry: which React Query keys to invalidate once rows land, and a label to
 * show before (or if) that call answers. When the API replies, its label and
 * description win; when it does not, the wizard still opens and still names
 * the thing being imported rather than showing a blank screen.
 */
export interface ImportEntityType {
    /** Path segment in `/imports/{type}/…`. Must match the backend's type names. */
    type: string;
    label: string;
    /** Used in sentences: "Import suppliers from a spreadsheet". */
    plural: string;
    description: string;
    /** Invalidated after a successful import so the list behind the wizard refreshes. */
    queryKey: readonly unknown[];
}

export const IMPORT_ENTITY_TYPES: readonly ImportEntityType[] = [
    {
        type: "assets",
        label: "Assets",
        plural: "assets",
        description: "Your asset register — tags, serial numbers, purchase cost, and where each one lives.",
        queryKey: qk.assets.all,
    },
    {
        type: "suppliers",
        label: "Suppliers",
        plural: "suppliers",
        description: "Vendors you buy from, with their contacts and statutory identifiers.",
        queryKey: qk.module("suppliers").all,
    },
    {
        type: "employees",
        label: "Employees",
        plural: "employees",
        description: "People who hold assets — names, employee numbers, departments.",
        queryKey: qk.employees.all,
    },
    {
        type: "locations",
        label: "Locations",
        plural: "locations",
        description: "Sites, buildings, and rooms that make up your physical footprint.",
        queryKey: qk.module("locations").all,
    },
    {
        type: "departments",
        label: "Departments",
        plural: "departments",
        description: "Departments with their codes and cost centres.",
        queryKey: qk.module("departments").all,
    },
    {
        type: "categories",
        label: "Categories",
        plural: "categories",
        description: "Asset categories, prefixes, and default warranty periods.",
        queryKey: qk.module("categories").all,
    },
    {
        type: "licenses",
        label: "Software licences",
        plural: "software licences",
        description: "Licence agreements, seat counts, and renewal dates.",
        queryKey: qk.module("licenses").all,
    },
    {
        type: "contracts",
        label: "Contracts",
        plural: "contracts",
        description: "Supplier agreements — SLAs, warranties, and leases — with values and renewal dates.",
        queryKey: qk.module("contracts").all,
    },
] as const;

const BY_TYPE = new Map(IMPORT_ENTITY_TYPES.map((entity) => [entity.type, entity]));

/** The registry entry for a type, or a generic one so an unknown type still renders. */
export function importEntityType(type: string): ImportEntityType {
    return (
        BY_TYPE.get(type) ?? {
            type,
            label: type.replace(/[-_]/g, " "),
            plural: type.replace(/[-_]/g, " "),
            description: "",
            queryKey: qk.module(type).all,
        }
    );
}

/** The registry entry with anything `GET /imports/types` told us layered on top. */
export function mergeImportType(type: string, summary: ImportTypeSummary | undefined): ImportEntityType {
    const local = importEntityType(type);
    if (!summary) return local;
    return {
        ...local,
        label: summary.label?.trim() || local.label,
        description: summary.description?.trim() || local.description,
    };
}
