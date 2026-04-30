import axios from "axios";

export function extractErrorMessage(error: unknown, fallback = "Something went wrong."): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: unknown; error?: unknown } | undefined;
        const message = typeof data?.message === "string" ? data.message : data?.error;
        return typeof message === "string" && message.trim() ? message : fallback;
    }

    return error instanceof Error && error.message.trim() ? error.message : fallback;
}
