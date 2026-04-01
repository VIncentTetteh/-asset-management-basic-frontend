export const formatRelativeTime = (value?: string | null): string => {
    if (!value) return "Unknown time";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown time";

    const diffMs = date.getTime() - Date.now();
    const absSeconds = Math.round(Math.abs(diffMs) / 1000);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

    if (absSeconds < 60) return rtf.format(Math.round(diffMs / 1000), "second");
    if (absSeconds < 3600) return rtf.format(Math.round(diffMs / 60000), "minute");
    if (absSeconds < 86400) return rtf.format(Math.round(diffMs / 3600000), "hour");
    if (absSeconds < 604800) return rtf.format(Math.round(diffMs / 86400000), "day");
    if (absSeconds < 2629800) return rtf.format(Math.round(diffMs / 604800000), "week");
    if (absSeconds < 31557600) return rtf.format(Math.round(diffMs / 2629800000), "month");
    return rtf.format(Math.round(diffMs / 31557600000), "year");
};
