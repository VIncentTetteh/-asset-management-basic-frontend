import api from "@/lib/axios";
import { User } from "@/types";

export interface SsoAuthorizeResponse {
    authorizationUrl?: string;
    redirectUrl?: string;
    url?: string;
    state?: string;
    provider?: string;
}

export interface SamlInitiateResponse {
    authorizationUrl?: string;
    redirectUrl?: string;
    url?: string;
    relayState?: string;
}

export interface SsoCallbackResponse {
    token?: string;
    user?: User;
    expiresIn?: number;
    loginMethod?: string;
    message?: string;
}

const resolveUrl = (payload: SsoAuthorizeResponse | SamlInitiateResponse): string => {
    const url = payload.authorizationUrl || payload.redirectUrl || payload.url;
    if (!url) {
        throw new Error("SSO provider did not return a redirect URL.");
    }
    return url;
};

export const ssoAuthService = {
    authorizeOAuth2: async (params?: { organisationId?: string; provider?: string; redirectUri?: string }): Promise<SsoAuthorizeResponse> => {
        const response = await api.get<SsoAuthorizeResponse>("/auth/sso/oauth2/authorize", {
            params: {
                organisationId: params?.organisationId,
                orgId: params?.organisationId,
                provider: params?.provider,
                redirectUri: params?.redirectUri,
            },
        });
        return response.data;
    },

    getOauth2AuthorizeUrl: async (organisationId: string, provider?: string, redirectUri?: string): Promise<SsoAuthorizeResponse> => {
        return ssoAuthService.authorizeOAuth2({ organisationId, provider, redirectUri });
    },

    getOAuth2AuthorizeUrl: async (params?: { organisationId?: string; provider?: string; redirectUri?: string }): Promise<string> => {
        const payload = await ssoAuthService.authorizeOAuth2(params);
        return resolveUrl(payload);
    },

    handleOAuth2Callback: async (params: { code?: string | null; state?: string | null; error?: string | null }): Promise<SsoCallbackResponse> => {
        const response = await api.get<SsoCallbackResponse>("/auth/sso/oauth2/callback", { params });
        return response.data;
    },

    oauth2Callback: async (code: string, state?: string): Promise<SsoCallbackResponse> => {
        return ssoAuthService.handleOAuth2Callback({ code, state });
    },

    samlAcs: async (data: { SAMLResponse: string; RelayState?: string } | FormData): Promise<SsoCallbackResponse> => {
        const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : undefined;
        const response = await api.post<SsoCallbackResponse>("/auth/sso/saml/acs", data, { headers });
        return response.data;
    },

    initiateSaml: async (params?: { organisationId?: string; provider?: string; relayState?: string }): Promise<SamlInitiateResponse> => {
        const response = await api.get<SamlInitiateResponse>("/auth/sso/saml/initiate", {
            params: {
                organisationId: params?.organisationId,
                orgId: params?.organisationId,
                provider: params?.provider,
                relayState: params?.relayState,
            },
        });
        return response.data;
    },

    getSamlInitiateUrl: async (organisationId: string, provider?: string): Promise<SamlInitiateResponse> => {
        return ssoAuthService.initiateSaml({ organisationId, provider });
    },

    getSamlRedirectUrl: async (params?: { organisationId?: string; provider?: string; relayState?: string }): Promise<string> => {
        const payload = await ssoAuthService.initiateSaml(params);
        return resolveUrl(payload);
    },
};
