/**
 * Invitations, and the vocabulary the API lends the UI for talking about
 * permissions in plain language.
 *
 * Mirrors `com.assetiq.dto.invitation` exactly. The one shape worth reading
 * twice is {@link InvitationIssued}: `acceptUrl` is non-null *only* when
 * `emailSent` is false, and showing it in any other circumstance would put a
 * live credential on an administrator's screen for no reason.
 */

/** `InvitationStatus` on the API. Expiry is already applied server-side. */
export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

/** Why a token cannot be redeemed. Only present when `valid` is false. */
export type InvitationInvalidReason = "UNKNOWN" | "EXPIRED" | "REVOKED" | "ACCEPTED";

/** An invitation as an administrator sees it. Never carries the token. */
export interface UserInvitation {
    id: string;
    email: string;
    status: InvitationStatus;
    roleId: string | null;
    roleName: string | null;
    departmentId: string | null;
    departmentName: string | null;
    firstName: string | null;
    lastName: string | null;
    jobTitle: string | null;
    note: string | null;
    expiresAt: string | null;
    createdAt: string | null;
    lastSentAt: string | null;
    sendCount: number;
    emailDelivered: boolean;
    invitedByName: string | null;
    acceptedAt: string | null;
    acceptedUserId: string | null;
    revokedAt: string | null;
}

/** Body of POST /invitations. */
export interface InviteUserRequest {
    email: string;
    roleId: string;
    departmentId?: string;
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    note?: string;
}

/**
 * The answer to issuing or resending an invitation.
 *
 * `emailSent` reports what happened, not what was intended. When it is false
 * the environment has no mail transport and `acceptUrl` carries the one-time
 * link so the administrator can pass it on themselves; when it is true the
 * link is null and the token lives only in the invitee's mailbox.
 */
export interface InvitationIssued {
    invitation: UserInvitation;
    emailSent: boolean;
    acceptUrl: string | null;
    message: string | null;
}

/** One permission, worded for a person rather than printed as an authority string. */
export interface PermissionDescription {
    key: string;
    /** Short verb phrase — "Dispose of assets". */
    label: string;
    /** One sentence an administrator can act on. */
    summary: string;
    /** Area of the product, e.g. "Assets", "People". */
    group: string;
    /** True when it permits change rather than only reading. */
    write: boolean;
    /** False when no endpoint consults it, so granting it does nothing. */
    enforced: boolean;
}

/** GET /roles/{id}/effective-permissions — what a holder can actually do. */
export interface RoleEffectivePermissions {
    roleId: string;
    roleName: string;
    description: string | null;
    systemRole: boolean;
    grantAllPermissions: boolean;
    permissionCount: number;
    permissions: PermissionDescription[];
    byGroup: Record<string, PermissionDescription[]>;
    /** Keys granted by the role that gate nothing today. */
    unenforced: string[];
}

/**
 * POST /invitations/lookup — always 200. An unusable token answers
 * `valid: false` with a `reason`, every other field null, so the acceptance
 * page can explain itself instead of rendering an error.
 */
export interface InvitationPreview {
    valid: boolean;
    reason: InvitationInvalidReason | null;
    organisationName: string | null;
    email: string | null;
    roleName: string | null;
    roleDescription: string | null;
    firstName: string | null;
    lastName: string | null;
    invitedByName: string | null;
    note: string | null;
    expiresAt: string | null;
    permissions: PermissionDescription[];
}

/** Body of POST /invitations/accept. Nothing here decides what the invitee may do. */
export interface AcceptInvitationRequest {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
    phone?: string;
    jobTitle?: string;
}

/**
 * The answer to redeeming an invitation. No session is issued: the invitee
 * signs in through the ordinary login flow. `organisationId` matters because
 * the same address may exist in several tenants.
 */
export interface InvitationAccepted {
    userId: string;
    email: string;
    organisationId: string;
    organisationName: string;
    roleName: string | null;
    message: string | null;
}
