import api from "@/lib/axios";
import { OrgSsoConfig, SsoOAuth2Dto, SsoSamlDto, SsoToggleDto } from "@/types";

export const orgSsoService = {
    /** GET /organisations/{orgId}/sso — returns config or null if not configured (204) */
    get: async (orgId: string): Promise<OrgSsoConfig | null> => {
        const response = await api.get(`/organisations/${orgId}/sso`);
        if (response.status === 204 || !response.data) return null;
        return response.data as OrgSsoConfig;
    },

    /** PUT /organisations/{orgId}/sso/oauth2 */
    configureOAuth2: async (orgId: string, data: SsoOAuth2Dto): Promise<OrgSsoConfig> => {
        const response = await api.put<OrgSsoConfig>(`/organisations/${orgId}/sso/oauth2`, data);
        return response.data;
    },

    /** PUT /organisations/{orgId}/sso/saml */
    configureSaml: async (orgId: string, data: SsoSamlDto): Promise<OrgSsoConfig> => {
        const response = await api.put<OrgSsoConfig>(`/organisations/${orgId}/sso/saml`, data);
        return response.data;
    },

    /** PATCH /organisations/{orgId}/sso/toggle */
    toggle: async (orgId: string, data: SsoToggleDto): Promise<OrgSsoConfig> => {
        const response = await api.patch<OrgSsoConfig>(`/organisations/${orgId}/sso/toggle`, data);
        return response.data;
    },
};
