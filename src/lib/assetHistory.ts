import { AssetHistory } from "@/types";
import { formatRelativeTime } from "@/lib/time";

const ACTION_MAP: Record<string, string> = {
    "post /assets": "Asset Created",
    "put /assets/{id}": "Asset Updated",
    "patch /assets/{id}": "Asset Updated",
    "delete /assets/{id}": "Asset Deleted",
    "post /assets/{id}/assign-user/{id}": "User Assigned",
    "delete /assets/{id}/assign-user": "User Unassigned",
    "post /assets/{id}/assign/{id}": "Department Assigned",
    "post /maintenance": "Maintenance Logged",
    "post /disposals": "Asset Disposed",
};

const normalizeToken = (value?: string | null): string =>
    String(value || "")
        .trim()
        .replace(/^\/api\/v\d+\//, "/")
        .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "{id}")
        .replace(/\/\d+\b/g, "/{id}")
        .replace(/\s+/g, " ")
        .toLowerCase();

const titleCase = (value: string): string =>
    value
        .toLowerCase()
        .split(/[\s/_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

export const getAssetHistoryLabel = (entry: AssetHistory): string => {
    const mapped = ACTION_MAP[normalizeToken(`${entry.httpMethod || ""} ${entry.path || ""}`)];
    if (mapped) return mapped;

    const eventType = entry.eventType || entry.action;
    if (eventType) return titleCase(String(eventType).replace(/\./g, " "));
    if (entry.summary) return entry.summary;
    return "Asset Activity";
};

export const normalizeAssetHistoryEntry = (entry: AssetHistory) => {
    const occurredAt = entry.occurredAt || entry.createdAt || null;
    return {
        ...entry,
        action: entry.action || entry.eventType || "Unknown Action",
        notes: entry.notes || entry.summary || entry.description || "",
        createdAt: entry.createdAt || entry.occurredAt || undefined,
        userName: entry.userName || entry.actor || undefined,
        label: getAssetHistoryLabel(entry),
        timeLabel: formatRelativeTime(occurredAt),
        detailText: entry.summary || entry.notes || entry.description || entry.path || "Activity recorded",
    };
};
