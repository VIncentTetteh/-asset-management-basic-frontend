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

const buildInitiateUrl = (params?: { organisationId?: string; provider?: string; exchangeRedirectUri?: string }): string => {
    if (!params?.organisationId) {
        throw new Error("Organisation is required to start SSO.");
    }
    const query = new URLSearchParams({ orgId: params.organisationId });
    if (params.provider) query.set("provider", params.provider);
    if (params.exchangeRedirectUri) query.set("exchangeRedirectUri", params.exchangeRedirectUri);
    const base = api.defaults.baseURL || "/api/v1";
    return `${base}/auth/sso/initiate?${query.toString()}`;
};

export const ssoAuthService = {
    authorizeOAuth2: async (params?: { organisationId?: string; provider?: string; redirectUri?: string; exchangeRedirectUri?: string }): Promise<SsoAuthorizeResponse> => {
        return { authorizationUrl: buildInitiateUrl({ ...params, exchangeRedirectUri: params?.exchangeRedirectUri ?? params?.redirectUri }) };
    },

    getOauth2AuthorizeUrl: async (organisationId: string, provider?: string, redirectUri?: string): Promise<SsoAuthorizeResponse> => {
        return ssoAuthService.authorizeOAuth2({ organisationId, provider, redirectUri });
    },

    getOAuth2AuthorizeUrl: async (params?: { organisationId?: string; provider?: string; redirectUri?: string }): Promise<string> => {
        const payload = await ssoAuthService.authorizeOAuth2(params);
        return resolveUrl(payload);
    },

    handleOAuth2Callback: async (params: { code?: string | null; state?: string | null; error?: string | null }): Promise<SsoCallbackResponse> => {
        if (params.error) {
            throw new Error(params.error);
        }
        const response = await api.post<SsoCallbackResponse>("/auth/sso/exchange", { code: params.code });
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
        return { redirectUrl: buildInitiateUrl({ organisationId: params?.organisationId, provider: params?.provider }) };
    },

    getSamlInitiateUrl: async (organisationId: string, provider?: string): Promise<SamlInitiateResponse> => {
        return ssoAuthService.initiateSaml({ organisationId, provider });
    },

    getSamlRedirectUrl: async (params?: { organisationId?: string; provider?: string; relayState?: string }): Promise<string> => {
        const payload = await ssoAuthService.initiateSaml(params);
        return resolveUrl(payload);
    },
};
