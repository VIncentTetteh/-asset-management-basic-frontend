import api from "@/lib/axios";
import { MfaSetupResponse, MfaVerifyDto, MfaDisableDto } from "@/types";

export const mfaService = {
    /** POST /mfa/setup — returns TOTP secret + QR code image */
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
};
