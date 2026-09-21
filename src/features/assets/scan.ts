import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { assetService } from "@/services/assetService";
import { categoryService } from "@/services/categoryService";
import { departmentService } from "@/services/departmentService";
import { locationService } from "@/services/locationService";
import { maintenanceService } from "@/services/maintenanceService";
import { userService } from "@/services/userService";
import type { AssetHistory, MaintenanceRecord } from "@/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECENT_HISTORY_LIMIT = 5;
const LOOKUP_STALE_MS = 5 * 60_000;
const DONE_MAINTENANCE = new Set(["COMPLETED", "CANCELLED", "CANCELED"]);

/** The asset id from a scanned label's `a` parameter, or null when it isn't a UUID. */
export const parseScannedAssetId = (raw: string | null | undefined): string | null => {
    const value = raw?.trim() ?? "";
    return UUID_PATTERN.test(value) ? value.toLowerCase() : null;
};

/** 403/404 look the same to the scanner: the asset is not theirs to see. */
export const isNotFoundOrForbidden = (error: unknown): boolean => {
    if (!axios.isAxiosError(error)) return false;
    const status = error.response?.status;
    return status === 403 || status === 404;
};

const scanKeys = {
    asset: (id: string) => ["assets", "scan", id] as const,
    history: (id: string) => ["assets", "history", id] as const,
    maintenance: (id: string) => ["maintenance", "list", { assetId: id }] as const,
    lookup: (kind: string, id: string) => [kind, "detail", id] as const,
};

/** Earliest upcoming maintenance date for the asset, if any is scheduled. */
export const nextMaintenanceDate = (records: readonly MaintenanceRecord[], today: Date = new Date()): string | null => {
    const todayIso = today.toISOString().slice(0, 10);
    const upcoming = records
        .flatMap((r) => {
            const open = !DONE_MAINTENANCE.has(String(r.status).toUpperCase());
            return [open ? r.scheduledDate : undefined, r.nextDueDate];
        })
        .filter((d): d is string => typeof d === "string" && d.slice(0, 10) >= todayIso)
        .sort();
    return upcoming[0] ?? null;
};

const newestFirst = (entries: readonly AssetHistory[]): AssetHistory[] =>
    [...entries]
        .sort((a, b) => String(b.occurredAt ?? b.createdAt ?? "").localeCompare(String(a.occurredAt ?? a.createdAt ?? "")))
        .slice(0, RECENT_HISTORY_LIMIT);

/** A lookup whose failure (often a missing permission) just leaves the field blank. */
function useNameLookup(kind: string, id: string | undefined, load: (id: string) => Promise<string>) {
    return useQuery({
        queryKey: scanKeys.lookup(kind, id ?? ""),
        queryFn: () => load(id as string),
        enabled: Boolean(id),
        staleTime: LOOKUP_STALE_MS,
        retry: false,
    });
}

/** Everything the scan page shows for one asset. */
export function useScannedAsset(assetId: string | null, enabled: boolean) {
    const active = enabled && assetId !== null;
    const asset = useQuery({
        queryKey: scanKeys.asset(assetId ?? ""),
        queryFn: () => assetService.getByQrPayload(assetId as string),
        enabled: active,
        retry: false,
    });
    const data = asset.data;
    const loaded = active && Boolean(data);

    const history = useQuery({
        queryKey: scanKeys.history(assetId ?? ""),
        queryFn: async () => newestFirst(await assetService.getHistory(assetId as string)),
        enabled: loaded,
        retry: false,
    });
    const maintenance = useQuery({
        queryKey: scanKeys.maintenance(assetId ?? ""),
        queryFn: async () => nextMaintenanceDate(await maintenanceService.getAll({ assetId: assetId as string })),
        enabled: loaded,
        retry: false,
    });

    const category = useNameLookup("categories", data?.categoryId, async (id) => (await categoryService.get(id)).name);
    const location = useNameLookup("locations", data?.locationId, async (id) => (await locationService.get(id)).name);
    const department = useNameLookup("departments", data?.departmentId, async (id) => (await departmentService.get(id)).name);
    const assignee = useNameLookup("users", data?.assignedUserId, async (id) => {
        const user = await userService.get(id);
        return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    });

    return {
        asset,
        history,
        nextMaintenance: maintenance.data ?? null,
        names: {
            category: category.data,
            location: location.data,
            department: department.data,
            assignee: assignee.data,
        },
    };
}
