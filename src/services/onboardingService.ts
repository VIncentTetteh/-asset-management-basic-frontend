import api from "@/lib/axios";
import type { OnboardingStatus } from "@/types/onboarding";

/**
 * The tenant's first-run checklist. Every step is derived from live counts on
 * the server, so the client never decides whether something is done.
 *
 * Distinct from employee onboarding under `/employees`, which is a joiner's
 * asset-handover checklist.
 */
export const onboardingService = {
    /** GET /onboarding — readable by anyone signed in. */
    getStatus: async (): Promise<OnboardingStatus> => {
        const response = await api.get<OnboardingStatus>("/onboarding");
        return response.data;
    },

    /** POST /onboarding/dismiss — hide the prompt for the whole organisation. */
    dismiss: async (): Promise<OnboardingStatus> => {
        const response = await api.post<OnboardingStatus>("/onboarding/dismiss");
        return response.data;
    },

    /** DELETE /onboarding/dismiss — show it again. */
    restore: async (): Promise<OnboardingStatus> => {
        const response = await api.delete<OnboardingStatus>("/onboarding/dismiss");
        return response.data;
    },
};
