"use client";

import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import type { Asset } from "@/types";
import { assetService } from "@/services/assetService";
import { qk } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** How many matches one search shows; narrowing the search finds the rest. */
export const ASSET_SEARCH_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

export interface PickedAsset {
  id: string;
  name?: string;
  assetTag?: string | null;
}

/**
 * Picks one asset by searching the register server-side (name, tag or model),
 * so every asset is reachable — unlike a select filled from one capped page.
 * `exclude` hides matches the caller cannot use (e.g. disposed assets).
 */
export function AssetSearchPicker({
  id,
  value,
  onChange,
  disabled = false,
  exclude,
  placeholder = "Search by name, tag or model…",
  invalid = false,
}: {
  id?: string;
  value: PickedAsset | null;
  onChange: (asset: PickedAsset | null) => void;
  disabled?: boolean;
  exclude?: (asset: Asset) => boolean;
  placeholder?: string;
  invalid?: boolean;
}) {
  const listId = useId();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  const params = { search: debounced || undefined, page: 0, size: ASSET_SEARCH_PAGE_SIZE, sort: "name,asc" };
  const results = useQuery({
    queryKey: qk.assets.list(params),
    queryFn: () => assetService.getPaged(params),
    enabled: !disabled && !value,
  });
  const matches = (results.data?.items ?? []).filter((a) => !exclude?.(a));

  if (value) {
    return (
      <div
        id={id}
        className="flex items-center justify-between gap-2 rounded-control border border-edge bg-surface-muted px-3 py-2 text-sm"
      >
        <span className="min-w-0 truncate">
          <span className="font-semibold text-foreground">{value.name ?? "Selected asset"}</span>
          <span className="ml-2 data-mono text-xs text-faint-fg">{value.assetTag || "no tag"}</span>
        </span>
        {!disabled ? (
          <button
            type="button"
            aria-label="Choose a different asset"
            className="ea-focus rounded-sm text-muted-fg hover:text-foreground"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
        <Input
          id={id}
          value={term}
          disabled={disabled}
          placeholder={placeholder}
          aria-controls={listId}
          aria-invalid={invalid || undefined}
          className="pl-8"
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>
      <ul
        id={listId}
        role="listbox"
        className="max-h-48 overflow-y-auto rounded-control border border-edge-subtle bg-surface text-sm"
      >
        {results.isLoading ? (
          <li className="px-3 py-2 text-xs text-muted-fg">Searching…</li>
        ) : matches.length === 0 ? (
          <li className="px-3 py-2 text-xs text-muted-fg">No matching assets.</li>
        ) : (
          matches.map((a) => (
            <li key={a.id} role="option" aria-selected={false}>
              <button
                type="button"
                className={cn("ea-focus flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-surface-muted")}
                onClick={() => onChange({ id: a.id!, name: a.name, assetTag: a.assetTag })}
              >
                <span className="truncate">{a.name}</span>
                <span className="data-mono shrink-0 text-xs text-faint-fg">{a.assetTag || "no tag"}</span>
              </button>
            </li>
          ))
        )}
        {(results.data?.total ?? 0) > ASSET_SEARCH_PAGE_SIZE ? (
          <li className="px-3 py-1.5 text-[11px] text-faint-fg">Showing the first {ASSET_SEARCH_PAGE_SIZE}; type to narrow.</li>
        ) : null}
      </ul>
    </div>
  );
}
