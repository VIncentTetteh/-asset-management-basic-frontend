"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { EstateSurface } from "@/features/insights/EstateSurface";
import { WasteSurface } from "@/features/insights/WasteSurface";
import { ExpiringSurface } from "@/features/insights/ExpiringSurface";
import { SpendSurface } from "@/features/insights/SpendSurface";
import { TrendsSurface } from "@/features/insights/TrendsSurface";

/**
 * Operations: five questions a manager would change a decision over.
 *
 * Deliberately separate from `/analytics`, which answers "how many assets,
 * grouped how?". Each view here is one question, stated as the tab label,
 * and every figure on it opens the records behind it.
 *
 * The view lives in the URL (`?view=waste`) so a tab can be linked to and
 * bookmarked — a manager who looks at expiring contracts every Monday should
 * not have to click through to it. Static export means that read happens in the
 * browser, so the page is wrapped in Suspense like the asset register.
 */

const VIEWS = [
    { key: "estate", label: "Estate value", question: "What is it worth, and where is it?" },
    { key: "waste", label: "Cost & waste", question: "What is costing money without earning it?" },
    { key: "expiring", label: "Expiring", question: "What is about to bite me?" },
    { key: "spend", label: "Spend", question: "Where is the money going?" },
    { key: "trends", label: "Trends", question: "What has actually changed?" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

const DEFAULT_VIEW: ViewKey = "estate";

const isViewKey = (value: string | null): value is ViewKey =>
    VIEWS.some((view) => view.key === value);

function OperationsPageInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const raw = searchParams.get("view");
    const view: ViewKey = isViewKey(raw) ? raw : DEFAULT_VIEW;
    const current = VIEWS.find((item) => item.key === view) ?? VIEWS[0];

    const select = (key: ViewKey) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", key);
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="page-enter space-y-4">
            <PageHeader title="Operations" subtitle={current.question} />

            {/* A tablist rather than links: the surfaces share a page and keyboard
                users expect arrow-key movement between tabs, not Tab-through-five. */}
            <div
                role="tablist"
                aria-label="Operational views"
                className="-mx-1 flex gap-1 overflow-x-auto border-b border-edge px-1 pb-px"
            >
                {VIEWS.map((item) => {
                    const active = item.key === view;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            role="tab"
                            id={`operations-tab-${item.key}`}
                            aria-selected={active}
                            aria-controls="operations-panel"
                            onClick={() => select(item.key)}
                            className={cn(
                                "ea-focus -mb-px shrink-0 whitespace-nowrap rounded-t-control border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors",
                                active
                                    ? "border-brand text-brand"
                                    : "border-transparent text-muted-fg hover:text-foreground",
                            )}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>

            <div id="operations-panel" role="tabpanel" aria-labelledby={`operations-tab-${view}`} tabIndex={-1}>
                {view === "estate" ? <EstateSurface /> : null}
                {view === "waste" ? <WasteSurface /> : null}
                {view === "expiring" ? <ExpiringSurface /> : null}
                {view === "spend" ? <SpendSurface /> : null}
                {view === "trends" ? <TrendsSurface /> : null}
            </div>
        </div>
    );
}

export default function OperationsPage() {
    return (
        <Suspense fallback={<PageSpinner />}>
            <OperationsPageInner />
        </Suspense>
    );
}
