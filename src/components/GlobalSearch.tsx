"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Search, Hexagon, Layers, MapPin, Users, X,
    ArrowRight, Building2, Wallet, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { usePermissions } from "@/contexts/PermissionContext";

interface SearchResult {
    id: string;
    label: string;
    sublabel?: string;
    type: "asset" | "department" | "location" | "user" | "budget" | "supplier";
    href: string;
}

const TYPE_CONFIG: Record<SearchResult["type"], { icon: React.ReactNode; color: string; label: string }> = {
    asset: {
        icon: <Hexagon className="h-4 w-4" />,
        color: "text-emerald-600 bg-emerald-50",
        label: "Asset",
    },
    department: {
        icon: <Layers className="h-4 w-4" />,
        color: "text-indigo-600 bg-indigo-50",
        label: "Department",
    },
    location: {
        icon: <MapPin className="h-4 w-4" />,
        color: "text-amber-600 bg-amber-50",
        label: "Location",
    },
    user: {
        icon: <Users className="h-4 w-4" />,
        color: "text-blue-600 bg-blue-50",
        label: "User",
    },
    budget: {
        icon: <Wallet className="h-4 w-4" />,
        color: "text-purple-600 bg-purple-50",
        label: "Budget",
    },
    supplier: {
        icon: <Building2 className="h-4 w-4" />,
        color: "text-slate-600 bg-slate-100",
        label: "Supplier",
    },
};

// Permission requirements per search category — must match Permission enum values.
const SEARCH_PERMISSIONS: Record<SearchResult["type"], string> = {
    asset:      "VIEW_ASSETS",
    department: "MANAGE_ORGANIZATION_SETTINGS",
    location:   "VIEW_LOCATIONS",
    user:       "VIEW_USERS",
    budget:     "VIEW_BUDGETS",
    supplier:   "VIEW_SUPPLIERS",
};

async function runSearch(
    query: string,
    canSearch: (permission: string) => boolean,
): Promise<SearchResult[]> {
    if (!query || query.trim().length < 2) return [];
    const q = query.toLowerCase();

    const results: SearchResult[] = [];

    try {
        // Only import and call services the user has permission to access.
        const serviceLoaders = await Promise.all([
            canSearch("VIEW_ASSETS")                    ? import("@/services/assetService")      : null,
            canSearch("MANAGE_ORGANIZATION_SETTINGS")   ? import("@/services/departmentService") : null,
            canSearch("VIEW_LOCATIONS")                 ? import("@/services/locationService")   : null,
            canSearch("VIEW_USERS")                     ? import("@/services/userService")        : null,
            canSearch("VIEW_BUDGETS")                   ? import("@/services/budgetService")      : null,
            canSearch("VIEW_SUPPLIERS")                 ? import("@/services/supplierService")    : null,
        ]);

        const [assetMod, deptMod, locMod, userMod, budgetMod, supplierMod] = serviceLoaders;

        const [assets, departments, locations, users, budgets, suppliers] =
            await Promise.allSettled([
                assetMod     ? assetMod.assetService.getAll()         : Promise.resolve([]),
                deptMod      ? deptMod.departmentService.getAll()     : Promise.resolve([]),
                locMod       ? locMod.locationService.getAll()        : Promise.resolve([]),
                userMod      ? userMod.userService.getAll()           : Promise.resolve([]),
                budgetMod    ? budgetMod.budgetService.getAll()       : Promise.resolve([]),
                supplierMod  ? supplierMod.supplierService.getAll()   : Promise.resolve([]),
            ]);

        if (assets.status === "fulfilled") {
            assets.value
                .filter(
                    (a) =>
                        a.name?.toLowerCase().includes(q) ||
                        a.assetTag?.toLowerCase().includes(q) ||
                        a.serialNumber?.toLowerCase().includes(q) ||
                        a.status?.toLowerCase().includes(q)
                )
                .slice(0, 5)
                .forEach((a) =>
                    results.push({
                        id: a.id!,
                        label: a.name,
                        sublabel: a.assetTag || a.status || "",
                        type: "asset",
                        href: `/assets?id=${a.id}`,
                    })
                );
        }

        if (departments.status === "fulfilled") {
            departments.value
                .filter(
                    (d) =>
                        d.name?.toLowerCase().includes(q) ||
                        d.departmentCode?.toLowerCase().includes(q)
                )
                .slice(0, 3)
                .forEach((d) =>
                    results.push({
                        id: d.id!,
                        label: d.name,
                        sublabel: d.departmentCode || d.status || "",
                        type: "department",
                        href: `/departments`,
                    })
                );
        }

        if (locations.status === "fulfilled") {
            locations.value
                .filter(
                    (l) =>
                        l.name?.toLowerCase().includes(q) ||
                        l.address?.toLowerCase().includes(q)
                )
                .slice(0, 3)
                .forEach((l) =>
                    results.push({
                        id: l.id!,
                        label: l.name,
                        sublabel: l.address || "",
                        type: "location",
                        href: `/locations`,
                    })
                );
        }

        if (users.status === "fulfilled") {
            users.value
                .filter(
                    (u) =>
                        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
                        u.email?.toLowerCase().includes(q)
                )
                .slice(0, 3)
                .forEach((u) =>
                    results.push({
                        id: u.id!,
                        label: `${u.firstName} ${u.lastName}`,
                        sublabel: u.email || u.role || "",
                        type: "user",
                        href: `/users`,
                    })
                );
        }

        if (budgets.status === "fulfilled") {
            budgets.value
                .filter((b) => b.name?.toLowerCase().includes(q))
                .slice(0, 3)
                .forEach((b) =>
                    results.push({
                        id: b.id!,
                        label: b.name,
                        sublabel: b.status || "",
                        type: "budget",
                        href: `/budgets`,
                    })
                );
        }

        if (suppliers.status === "fulfilled") {
            suppliers.value
                .filter(
                    (s) =>
                        s.name?.toLowerCase().includes(q) ||
                        s.email?.toLowerCase().includes(q)
                )
                .slice(0, 2)
                .forEach((s) =>
                    results.push({
                        id: s.id!,
                        label: s.name,
                        sublabel: s.email || s.phone || "",
                        type: "supplier",
                        href: `/suppliers`,
                    })
                );
        }
    } catch (err) {
        console.error("[GlobalSearch] Error:", err);
    }

    return results;
}

export function GlobalSearch() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { hasPermission } = usePermissions();

    // Keyboard shortcut Ctrl+K / Cmd+K
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === "Escape") setIsOpen(false);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setQuery("");
            setResults([]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.trim().length < 2) {
            setResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        debounceRef.current = setTimeout(async () => {
            const found = await runSearch(query, hasPermission);
            setResults(found);
            setActiveIndex(0);
            setIsSearching(false);
        }, 320);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    const handleSelect = useCallback(
        (result: SearchResult) => {
            setIsOpen(false);
            router.push(result.href);
        },
        [router]
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && results[activeIndex]) {
            handleSelect(results[activeIndex]);
        }
    };

    return (
        <>
            {/* Trigger bar */}
            <button
                onClick={() => setIsOpen(true)}
                className="hidden lg:flex items-center gap-2 w-72 h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 hover:border-teal-300 hover:bg-white transition-all cursor-pointer"
            >
                <Search className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Search assets, depts, users…</span>
                <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                    ⌘K
                </kbd>
            </button>

            {/* Mobile trigger */}
            <button
                onClick={() => setIsOpen(true)}
                className="lg:hidden flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white transition-all"
                aria-label="Open search"
            >
                <Search className="h-4 w-4 text-slate-500" />
            </button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Input row */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                            {isSearching ? (
                                <Spinner size="sm" className="text-teal-600 shrink-0" />
                            ) : (
                                <Search className="h-5 w-5 text-slate-400 shrink-0" />
                            )}
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search assets, departments, users, budgets…"
                                className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                                autoComplete="off"
                            />
                            {query && (
                                <button
                                    onClick={() => setQuery("")}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Results */}
                        <div className="max-h-[60vh] overflow-y-auto">
                            {query.trim().length >= 2 && !isSearching && results.length === 0 && (
                                <div className="py-12 text-center">
                                    <p className="text-sm text-slate-500">No results for <span className="font-medium text-slate-700">"{query}"</span></p>
                                </div>
                            )}
                            {results.length > 0 && (
                                <ul className="py-2">
                                    {results.map((result, idx) => {
                                        const config = TYPE_CONFIG[result.type];
                                        return (
                                            <li key={`${result.type}-${result.id}`}>
                                                <button
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                                                        idx === activeIndex
                                                            ? "bg-teal-50"
                                                            : "hover:bg-slate-50"
                                                    )}
                                                    onClick={() => handleSelect(result)}
                                                    onMouseEnter={() => setActiveIndex(idx)}
                                                >
                                                    <span className={cn("flex-shrink-0 p-1.5 rounded-lg", config.color)}>
                                                        {config.icon}
                                                    </span>
                                                    <span className="flex-1 min-w-0">
                                                        <span className="block text-sm font-medium text-slate-900 truncate">
                                                            {result.label}
                                                        </span>
                                                        {result.sublabel && (
                                                            <span className="block text-xs text-slate-500 truncate">
                                                                {result.sublabel}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="shrink-0 flex items-center gap-1">
                                                        <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">
                                                            {config.label}
                                                        </span>
                                                        <ChevronRight className="h-3 w-3 text-slate-300" />
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}

                            {/* Quick nav when empty — filtered by user permissions */}
                            {!query && (() => {
                                const quickItems = [
                                    { label: "Assets",      href: "/assets",      icon: <Hexagon className="h-4 w-4" />,  color: "text-emerald-600", permission: "VIEW_ASSETS" },
                                    { label: "Departments", href: "/departments", icon: <Layers className="h-4 w-4" />,   color: "text-indigo-600",  permission: "MANAGE_ORGANIZATION_SETTINGS" },
                                    { label: "Locations",   href: "/locations",   icon: <MapPin className="h-4 w-4" />,   color: "text-amber-600",   permission: "VIEW_LOCATIONS" },
                                    { label: "Users",       href: "/users",       icon: <Users className="h-4 w-4" />,    color: "text-blue-600",    permission: "VIEW_USERS" },
                                    { label: "Budgets",     href: "/budgets",     icon: <Wallet className="h-4 w-4" />,   color: "text-purple-600",  permission: "VIEW_BUDGETS" },
                                    { label: "Suppliers",   href: "/suppliers",   icon: <Building2 className="h-4 w-4" />,color: "text-slate-600",   permission: "VIEW_SUPPLIERS" },
                                ].filter(item => hasPermission(item.permission));

                                if (quickItems.length === 0) return null;
                                return (
                                    <div className="py-3 px-4">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Quick Navigate</p>
                                        <div className="grid grid-cols-2 gap-1">
                                            {quickItems.map((item) => (
                                                <button
                                                    key={item.href}
                                                    onClick={() => { setIsOpen(false); router.push(item.href); }}
                                                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                >
                                                    <span className={item.color}>{item.icon}</span>
                                                    {item.label}
                                                    <ArrowRight className="ml-auto h-3 w-3 text-slate-300" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between">
                            <span className="text-xs text-slate-400">
                                {results.length > 0 ? `${results.length} result${results.length !== 1 ? "s" : ""}` : "Type to search"}
                            </span>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                <span className="flex items-center gap-1"><kbd className="border border-slate-200 rounded px-1">↑↓</kbd> navigate</span>
                                <span className="flex items-center gap-1"><kbd className="border border-slate-200 rounded px-1">↵</kbd> open</span>
                                <span className="flex items-center gap-1"><kbd className="border border-slate-200 rounded px-1">Esc</kbd> close</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
