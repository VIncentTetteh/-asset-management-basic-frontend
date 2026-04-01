import api from "@/lib/axios";
import { MfaSetupResponse, MfaVerifyDto, MfaDisableDto, MfaChallengeVerifyResponse } from "@/types";

export interface MfaChallengeDto {
    mfaChallengeToken: string;
    code: string;
}

export const mfaService = {
    /** POST /mfa/setup — returns TOTP secret + QR code image (base64 data URI) */
    setup: async (): Promise<MfaSetupResponse> => {
        const response = await api.post<MfaSetupResponse>("/mfa/setup");
        return response.data;
    },

    /** POST /mfa/verify — verifies TOTP code and enables MFA */
    verify: async (data: MfaVerifyDto): Promise<{ message: string }> => {
        const response = await api.post<{ message: string }>("/mfa/verify", data);
        return response.data;
    },

    /** DELETE /mfa/disable — disables MFA (requires current TOTP code in body) */
    disable: async (data: MfaDisableDto): Promise<{ message: string }> => {
        const response = await api.delete<{ message: string }>("/mfa/disable", { data });
        return response.data;
    },

    /**
     * POST /mfa/challenge — exchange a short-lived MFA challenge token + TOTP code
     * for a full-access JWT. Called during the login flow when mfaRequired === true.
     * This endpoint is permit-all (no Bearer token required).
     */
    challenge: async (data: MfaChallengeDto): Promise<MfaChallengeVerifyResponse> => {
        const response = await api.post<MfaChallengeVerifyResponse>("/mfa/challenge", data);
        return response.data;
    },

    /**
     * DELETE /mfa/admin/reset/{userId} — admin-only forced MFA reset.
     * Clears mfa_enabled + mfa_secret without needing a TOTP code.
     * Use for account recovery when a user has lost their authenticator device.
     */
    adminReset: async (userId: string): Promise<{ message: string }> => {
        const response = await api.delete<{ message: string }>(`/mfa/admin/reset/${userId}`);
        return response.data;
    },
};
