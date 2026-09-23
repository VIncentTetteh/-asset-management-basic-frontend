"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { onboardingService } from "@/services/onboardingService";
import { qk } from "@/lib/queryClient";
import type { OnboardingStatus } from "@/types/onboarding";

const onboardingKey = qk.module("onboarding");

/**
 * The tenant's setup checklist.
 *
 * Every step's `done` comes from a live count on the server, so nothing here
 * ever decides a step is finished on the client's behalf — including after a
 * mutation elsewhere in the app, which is why the cache is short-lived rather
 * than optimistically patched.
 */
export function useOnboarding(enabled = true) {
    return useQuery({
        queryKey: onboardingKey.list(),
        queryFn: () => onboardingService.getStatus(),
        enabled,
        staleTime: 30_000,
    });
}

function useApplyStatus() {
    const queryClient = useQueryClient();
    return (status: OnboardingStatus) => queryClient.setQueryData(onboardingKey.list(), status);
}

/** Hiding the prompt hides it for the whole organisation; the steps keep reporting the truth. */
export function useDismissOnboarding() {
    const apply = useApplyStatus();
    return useMutation({
        mutationFn: () => onboardingService.dismiss(),
        onSuccess: apply,
    });
}

export function useRestoreOnboarding() {
    const apply = useApplyStatus();
    return useMutation({
        mutationFn: () => onboardingService.restore(),
        onSuccess: apply,
    });
}

/**
 * Where in the web app a step is completed.
 *
 * The API gives `apiPath`, which is where *it* creates the thing — not a route
 * in this app, and deliberately so: the backend has no business knowing the
 * front end's URLs. The mapping belongs here, keyed on the stable step key.
 * A key with no entry renders without a link rather than guessing a route that
 * would 404.
 */
export const STEP_ROUTES: Record<string, { href: string; cta: string }> = {
    add_locations: { href: "/locations", cta: "Add a location" },
    add_categories: { href: "/categories", cta: "Add a category" },
    add_departments: { href: "/departments", cta: "Add a department" },
    add_assets: { href: "/assets", cta: "Add an asset" },
    invite_team: { href: "/users", cta: "Invite a colleague" },
};
