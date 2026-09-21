"use client";

import { useEffect } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { PLAN_LIMIT_EVENT, isHandledInline, type PlanLimitDetail } from "@/lib/plan-limit";

const PLAN_LIMIT_TOAST_ID = "plan-limit";
const PLAN_LIMIT_TOAST_MS = 8000;

/**
 * Reacts to one plan-limit 403. Pages that render their own upgrade card
 * (analytics) are left alone; anything else gets a single, deduplicated,
 * non-blocking toast with an Upgrade link. Returns whether a toast was shown.
 */
export function showPlanLimitNotice(detail: PlanLimitDetail | undefined): boolean {
    if (isHandledInline(detail?.url)) return false;
    const message = detail?.message || "You have reached a limit of your current plan.";
    toast(
        (t) => (
            <span className="flex items-center gap-3 text-sm">
                <span>{message}</span>
                <Link
                    href="/billing"
                    onClick={() => toast.dismiss(t.id)}
                    className="shrink-0 font-semibold text-brand underline underline-offset-4"
                >
                    Upgrade
                </Link>
            </span>
        ),
        { id: PLAN_LIMIT_TOAST_ID, duration: PLAN_LIMIT_TOAST_MS },
    );
    return true;
}

/** Subscribes the app shell to plan-limit events raised by the axios interceptor. */
export function usePlanLimitNotices(): void {
    useEffect(() => {
        const onPlanLimit = (event: Event) => {
            showPlanLimitNotice((event as CustomEvent<PlanLimitDetail>).detail);
        };
        window.addEventListener(PLAN_LIMIT_EVENT, onPlanLimit);
        return () => window.removeEventListener(PLAN_LIMIT_EVENT, onPlanLimit);
    }, []);
}
