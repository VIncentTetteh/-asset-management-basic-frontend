"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DetailTab {
  id: string;
  label: string;
  /** Small count bubble, e.g. open checklist items. */
  count?: number;
  content: React.ReactNode;
}

/**
 * The standard record page: back link → identity header (title, meta chips,
 * actions) → tab bar → tab content. Used by asset, employee, supplier, PO…
 * detail screens so every record in the product reads the same way.
 */
export function DetailPageTemplate({
  backHref,
  backLabel,
  title,
  titleAccessory,
  meta,
  actions,
  tabs,
  defaultTab,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  /** Rendered next to the title, e.g. an AssetTag or StatusBadge. */
  titleAccessory?: React.ReactNode;
  /** Row of meta facts under the title. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  tabs: DetailTab[];
  defaultTab?: string;
}) {
  const [active, setActive] = React.useState(defaultTab ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="page-enter space-y-4">
      <Link
        href={backHref}
        className="ea-focus inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-muted-fg hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-[22px] font-extrabold tracking-tight text-foreground">{title}</h1>
            {titleAccessory}
          </div>
          {meta ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-fg">
              {meta}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      <div className="border-b border-edge" role="tablist" aria-label={`${title} sections`}>
        <div className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === current?.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                "ea-focus whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors",
                tab.id === current?.id
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-fg hover:text-foreground",
              )}
            >
              {tab.label}
              {typeof tab.count === "number" ? (
                <span className="ml-1.5 rounded-full bg-surface-sunken px-1.5 py-0.5 text-[11px] font-bold text-muted-fg">
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
