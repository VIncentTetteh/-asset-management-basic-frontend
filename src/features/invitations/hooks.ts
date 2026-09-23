"use client";

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invitationService } from "@/services/invitationService";
import { qk } from "@/lib/queryClient";
import { extractErrorMessage } from "@/lib/error";
import type { InvitationStatus, InviteUserRequest } from "@/types/invitations";

const invitationsKey = qk.module("invitations");

export function useInvitations(params: { status?: InvitationStatus; limit?: number; offset?: number }) {
    return useQuery({
        queryKey: invitationsKey.list(params),
        queryFn: () => invitationService.list(params),
        // A fresh page is cheap and a stale one is actively misleading: an
        // invitation another admin revoked a minute ago should not still offer
        // a Resend button.
        staleTime: 15_000,
    });
}

export function useInvalidateInvitations() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: invitationsKey.all });
}

export function useInviteColleague() {
    const invalidate = useInvalidateInvitations();
    return useMutation({
        mutationFn: (data: InviteUserRequest) => invitationService.invite(data),
        onSuccess: invalidate,
    });
}

export function useResendInvitation() {
    const invalidate = useInvalidateInvitations();
    return useMutation({
        mutationFn: (id: string) => invitationService.resend(id),
        onSuccess: invalidate,
    });
}

export function useRevokeInvitation() {
    const invalidate = useInvalidateInvitations();
    return useMutation({
        mutationFn: (id: string) => invitationService.revoke(id),
        onSuccess: invalidate,
    });
}

/**
 * How long a 429 says to wait, in whole seconds, or null when it did not say.
 *
 * `Retry-After` is the only part of a rate-limit response a user can act on:
 * without it "try again later" is advice with no content.
 */
function retryAfterSeconds(error: unknown): number | null {
    if (!axios.isAxiosError(error) || error.response?.status !== 429) return null;
    const header = error.response.headers?.["retry-after"] ?? error.response.headers?.["Retry-After"];
    const seconds = Number(header);
    return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/**
 * One sentence explaining why an invitation call failed, in the words the API
 * used wherever it gave any.
 *
 * Every failure this endpoint produces is already a plain sentence — "already a
 * member", "that role grants permissions you do not hold", "no seat free" — so
 * the job here is to pass it through rather than to replace it with a generic
 * "something went wrong", and to add the one thing the body cannot carry: how
 * long a rate limit lasts.
 */
export function describeInvitationError(error: unknown, fallback: string): string {
    const wait = retryAfterSeconds(error);
    if (wait !== null) {
        const message = extractErrorMessage(error, "Too many invitations have been sent from this organisation just now.");
        return `${message} Try again in ${wait} second${wait === 1 ? "" : "s"}.`;
    }
    if (axios.isAxiosError(error) && error.response?.status === 429) {
        return extractErrorMessage(error, "Too many invitations have been sent just now. Try again shortly.");
    }
    return extractErrorMessage(error, fallback);
}
