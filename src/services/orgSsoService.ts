import api from "@/lib/axios";
import { OrgSsoConfig, SsoDiscoverResponse, SsoOAuth2Dto, SsoSamlDto, SsoToggleDto } from "@/types";
import { invalidateRequestCache, withRequestCache } from "@/services/requestCache";

export const orgSsoService = {
    /** GET /organisations/{orgId}/sso — returns config or null if not configured (204) */
    get: async (orgId: string): Promise<OrgSsoConfig | null> => {
        return withRequestCache(`sso:${orgId}`, async () => {
            try {
                const response = await api.get(`/organisations/${orgId}/sso`);
                if (response.status === 204 || !response.data) return null;
                return response.data as OrgSsoConfig;
            } catch (error: any) {
                if (error?.response?.status === 404) return null;
                throw error;
            }
        }, 60_000);
    },

    /** GET /auth/sso/discover?email= — public, resolves org SSO by email domain */
    discoverByEmail: async (email: string): Promise<SsoDiscoverResponse> => {
        try {
            const response = await api.get<SsoDiscoverResponse>("/auth/sso/discover", {
                params: { email },
            });
            return response.data;
        } catch {
            return { ssoEnabled: false };
        }
    },

    /** PUT /organisations/{orgId}/sso/oauth2 */
    configureOAuth2: async (orgId: string, data: SsoOAuth2Dto): Promise<OrgSsoConfig> => {
        const response = await api.put<OrgSsoConfig>(`/organisations/${orgId}/sso/oauth2`, data);
        invalidateRequestCache(`sso:${orgId}`);
        return response.data;
    },

    /** PUT /organisations/{orgId}/sso/saml */
    configureSaml: async (orgId: string, data: SsoSamlDto): Promise<OrgSsoConfig> => {
        const response = await api.put<OrgSsoConfig>(`/organisations/${orgId}/sso/saml`, data);
        invalidateRequestCache(`sso:${orgId}`);
        return response.data;
    },

    /** PATCH /organisations/{orgId}/sso/toggle */
    toggle: async (orgId: string, data: SsoToggleDto): Promise<OrgSsoConfig> => {
        const response = await api.patch<OrgSsoConfig>(`/organisations/${orgId}/sso/toggle`, data);
        invalidateRequestCache(`sso:${orgId}`);
        return response.data;
    },
};
