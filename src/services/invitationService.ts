import api from "@/lib/axios";
import { normalizePage, type NormalizedPage } from "@/services/responseUtils";
import type {
    AcceptInvitationRequest,
    InvitationAccepted,
    InvitationIssued,
    InvitationPreview,
    InvitationStatus,
    InviteUserRequest,
    UserInvitation,
} from "@/types/invitations";

/**
 * Inviting colleagues, and joining on an invitation.
 *
 * Two audiences share this path. The administrative calls are tenant-scoped and
 * carry the session cookie plus `X-Organisation-Id` like everything else. The
 * two acceptance calls are necessarily public — the caller has no account yet —
 * and authenticate with the invitation token in the request *body*, never the
 * query string, so the credential stays out of access logs and referrers.
 */
export const invitationService = {
    /** POST /invitations — invite a colleague with a chosen role. */
    invite: async (data: InviteUserRequest): Promise<InvitationIssued> => {
        const response = await api.post<InvitationIssued>("/invitations", data);
        return response.data;
    },

    /** GET /invitations — one page of this organisation's invitations. */
    list: async (params: { status?: InvitationStatus; limit?: number; offset?: number } = {}): Promise<NormalizedPage<UserInvitation>> => {
        const response = await api.get("/invitations", {
            params: {
                ...(params.status ? { status: params.status } : {}),
                limit: params.limit ?? 25,
                offset: params.offset ?? 0,
            },
        });
        return normalizePage<UserInvitation>(response.data);
    },

    /** POST /invitations/{id}/resend — new token, new expiry, same person and role. */
    resend: async (id: string): Promise<InvitationIssued> => {
        const response = await api.post<InvitationIssued>(`/invitations/${id}/resend`);
        return response.data;
    },

    /** POST /invitations/{id}/revoke — the link stops working immediately. */
    revoke: async (id: string): Promise<UserInvitation> => {
        const response = await api.post<UserInvitation>(`/invitations/${id}/revoke`);
        return response.data;
    },

    // ── Public: redeeming a link ──────────────────────────────────────────────

    /**
     * POST /invitations/lookup — what this token is worth.
     *
     * Always 200: an unusable token answers `valid: false` with a reason, so a
     * failed lookup here really is a network or server failure and must be
     * reported as one rather than shown as "this link is invalid".
     */
    lookup: async (token: string): Promise<InvitationPreview> => {
        const response = await api.post<InvitationPreview>("/invitations/lookup", { token });
        return response.data;
    },

    /** POST /invitations/accept — create the account and spend the token. No session is issued. */
    accept: async (data: AcceptInvitationRequest): Promise<InvitationAccepted> => {
        const response = await api.post<InvitationAccepted>("/invitations/accept", data);
        return response.data;
    },
};
