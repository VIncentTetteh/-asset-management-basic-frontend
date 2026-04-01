"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { billingService } from "@/services/billingService";
import { Subscription } from "@/types";
import { CurrencyProvider, useCurrency } from "@/contexts/CurrencyContext";

// Inner layout — can safely use useCurrency since it's inside <CurrencyProvider>
function AppLayoutInner({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [orgName, setOrgName] = useState<string>("AssetIQ");
    const [userRole, setUserRole] = useState<string>("ROLE_USER");
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [isPlanLimitOpen, setIsPlanLimitOpen] = useState(false);
    const [planLimitMessage, setPlanLimitMessage] = useState("");

    const { currency, setCurrency } = useCurrency();

    const publicPaths = ["/", "/login", "/register", "/register-tenant", "/forgot-password", "/reset-password"];
    const isPublicPage = publicPaths.includes(pathname);
    const breadcrumb = pathname.split("/").filter(Boolean).join(" / ") || "home";

    useEffect(() => {
        const fetchOrg = async () => {
            const storedUserStr = localStorage.getItem("user");
            if (storedUserStr) {
                const user = JSON.parse(storedUserStr);
                if (user?.role) setUserRole(user.role);
                if (user.organisationId) {
                    try {
                        const { organisationService } = await import("@/services/organisationService");
                        const orgs = await organisationService.getAll();
                        if (orgs.length > 0) {
                            setOrgName(orgs[0].name);
                        }
                    } catch (e) {
                        console.error("Failed to fetch org name for layout:", e);
                    }
                }
            }
        };
        if (isAuthorized) fetchOrg();
    }, [isAuthorized]);

    useEffect(() => {
        const loadSubscription = async () => {
            if (!isAuthorized || isPublicPage) return;
            try {
                const sub = await billingService.getSubscription();
                setSubscription(sub);
            } catch {
                // Billing may not be configured in all environments.
            }
        };
        loadSubscription();
    }, [isAuthorized, isPublicPage, pathname]);

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isMounted) return;
        const token = localStorage.getItem("token");
        if (!token && !isPublicPage) {
            setIsAuthorized(false);
            router.push("/login");
        } else {
            setIsAuthorized(true);
        }
    }, [pathname, router, isPublicPage, isMounted]);

    useEffect(() => {
        const onPlanLimit = (event: Event) => {
            const detail = (event as CustomEvent<{ message?: string }>).detail;
            setPlanLimitMessage(detail?.message || "You have reached your plan limits.");
            setIsPlanLimitOpen(true);
        };
        window.addEventListener("plan-limit-error", onPlanLimit as EventListener);
        return () => window.removeEventListener("plan-limit-error", onPlanLimit as EventListener);
    }, []);

    if (!isMounted) return null;
    if (!isAuthorized && !isPublicPage) return null;
    if (isPublicPage) return <>{children}</>;

    const assetUsagePercent = subscription?.plan?.maxAssets
        ? Math.round((subscription.currentAssetCount / subscription.plan.maxAssets) * 100)
        : 0;
    const employeeUsagePercent = subscription?.plan?.maxEmployees
        ? Math.round((subscription.currentEmployeeCount / subscription.plan.maxEmployees) * 100)
        : 0;
    const showUsageWarning = Math.max(assetUsagePercent, employeeUsagePercent) >= 80;

    return (
        <div className="ea-shell-gradient flex h-screen overflow-hidden bg-slate-50">
            <div className="hidden md:block">
                <Sidebar />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 border-b border-slate-200 bg-white/90 backdrop-blur flex items-center justify-between px-4 md:px-6 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="md:hidden font-bold text-lg text-teal-700 truncate">{orgName}</span>
                        <div className="hidden md:block">
                            <p className="text-xs uppercase tracking-wider text-slate-500">Workspace</p>
                            <p className="text-sm font-semibold text-slate-800 truncate">{breadcrumb}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="hidden lg:flex relative w-72">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                className="pl-9"
                                placeholder="Search assets, users, suppliers..."
                                aria-label="Global search"
                            />
                        </div>

                        {/* Currency switcher */}
                        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                            {(["USD", "GHS"] as const).map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCurrency(c)}
                                    title={c === "USD" ? "US Dollar" : "Ghana Cedi"}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                                        currency === c
                                            ? "bg-teal-600 text-white shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    {c === "USD" ? "$ USD" : "₵ GHS"}
                                </button>
                            ))}
                        </div>

                        <Button variant="outline" size="icon" aria-label="Notifications">
                            <Bell className="h-4 w-4" />
                        </Button>
                        <div className="hidden md:flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-semibold text-slate-700 truncate max-w-[170px]">{orgName}</span>
                            <span className="text-[10px] uppercase tracking-wide text-slate-500">{userRole.replace("ROLE_", "")}</span>
                        </div>
                    </div>
                </header>
                <main className="flex-1 overflow-auto p-4 md:p-8">
                    {showUsageWarning && pathname !== "/billing" ? (
                        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Plan usage warning: assets {subscription?.currentAssetCount}/{subscription?.plan?.maxAssets} ({assetUsagePercent}%), employees {subscription?.currentEmployeeCount}/{subscription?.plan?.maxEmployees} ({employeeUsagePercent}%).
                            <button
                                type="button"
                                className="ml-2 font-semibold underline"
                                onClick={() => router.push("/billing")}
                            >
                                Upgrade plan
                            </button>
                        </div>
                    ) : null}
                    {children}
                </main>
            </div>

            <Modal
                isOpen={isPlanLimitOpen}
                onClose={() => setIsPlanLimitOpen(false)}
                title="Plan Limit Reached"
                description="Your current subscription limits this action."
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-700">{planLimitMessage || "Upgrade your plan to continue this operation."}</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsPlanLimitOpen(false)}>Close</Button>
                        <Button onClick={() => { setIsPlanLimitOpen(false); router.push("/billing"); }}>Upgrade Plan</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

// Outer wrapper — provides currency context to the entire app shell
export function AppLayoutClient({ children }: { children: React.ReactNode }) {
    return (
        <CurrencyProvider>
            <AppLayoutInner>{children}</AppLayoutInner>
        </CurrencyProvider>
    );
}
