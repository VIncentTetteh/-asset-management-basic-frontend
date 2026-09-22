/** A small fallback when the runtime cannot list its zones (older engines). */
const FALLBACK_ZONES = ["UTC", "Africa/Accra", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg",
    "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Singapore"];

/**
 * IANA time-zone region ids for a select, UTC first. The API validates the same ids
 * with `ZoneId.of`. A stored value the list lacks (e.g. a legacy alias) is kept as an
 * option so editing another field does not blank it.
 */
export function timeZoneOptions(current?: string | null): string[] {
    let zones: string[];
    try {
        zones = Intl.supportedValuesOf("timeZone");
    } catch {
        zones = FALLBACK_ZONES;
    }
    const set = new Set<string>(["UTC", ...zones]);
    if (current && current.trim()) set.add(current.trim());
    return ["UTC", ...[...set].filter((z) => z !== "UTC").sort()];
}
