import api from "@/lib/axios";
import { isAxiosError } from "axios";
import { OrgSsoConfig, SsoDiscoverResponse, SsoDomainStatus, SsoOAuth2Dto, SsoSamlDto, SsoToggleDto } from "@/types";
import { invalidateRequestCache, withRequestCache } from "@/services/requestCache";

export const orgSsoService = {
    /** GET /organisations/{orgId}/sso — returns config or null if not configured (204) */
    get: async (orgId: string): Promise<OrgSsoConfig | null> => {
        return withRequestCache(`sso:${orgId}`, async () => {
            try {
                const response = await api.get(`/organisations/${orgId}/sso`);
                if (response.status === 204 || !response.data) return null;
                return response.data as OrgSsoConfig;
            } catch (error: unknown) {
                if (isAxiosError(error) && error.response?.status === 404) return null;
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

    /**
     * PUT /organisations/{orgId}/sso/oauth2. `replaceExisting` must be true to
     * replace a SAML configuration (the API answers 409 otherwise).
     */
    configureOAuth2: async (orgId: string, data: SsoOAuth2Dto, options?: { replaceExisting?: boolean }): Promise<OrgSsoConfig> => {
        const response = await api.put<OrgSsoConfig>(`/organisations/${orgId}/sso/oauth2`, data, {
            params: options?.replaceExisting ? { replaceExisting: true } : undefined,
        });
        invalidateRequestCache(`sso:${orgId}`);
        return response.data;
    },

    /** PUT /organisations/{orgId}/sso/saml. See `configureOAuth2` for `replaceExisting`. */
    configureSaml: async (orgId: string, data: SsoSamlDto, options?: { replaceExisting?: boolean }): Promise<OrgSsoConfig> => {
        const response = await api.put<OrgSsoConfig>(`/organisations/${orgId}/sso/saml`, data, {
            params: options?.replaceExisting ? { replaceExisting: true } : undefined,
        });
        invalidateRequestCache(`sso:${orgId}`);
        return response.data;
    },

    /**
     * GET /organisations/{orgId}/sso/domain — the email domain claim and whether
     * it has been verified. SSO discovery routes on the domain only once it is.
     */
    domainStatus: async (orgId: string): Promise<SsoDomainStatus> => {
        const response = await api.get<SsoDomainStatus>(`/organisations/${orgId}/sso/domain`);
        return response.data;
    },

    /** POST /organisations/{orgId}/sso/domain/verify — looks for the TXT record. */
    verifyDomain: async (orgId: string): Promise<SsoDomainStatus> => {
        const response = await api.post<SsoDomainStatus>(`/organisations/${orgId}/sso/domain/verify`);
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
