"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { QueryProvider } from "@/components/QueryProvider";
import { Modal } from "@/components/ui/modal";
import { billingService } from "@/services/billingService";
import { authService } from "@/services/authService";
import { organisationService } from "@/services/organisationService";
import { Subscription } from "@/types";
import {
    extractOrganisationName,
    getOrganisationIdFromStorage,
    getStoredUser,
    mergeStoredUser,
    verifyOrganisationContext,
} from "@/lib/authContext";
import { CurrencyProvider, useCurrency } from "@/contexts/CurrencyContext";
import { PermissionProvider, usePermissions } from "@/contexts/PermissionContext";
import { LicenseProvider } from "@/contexts/LicenseContext";
import { LicenseBanner } from "@/components/LicenseBanner";
import { ConfirmDialogHost } from "@/hooks/useConfirm";
import { AiAssistant } from "@/components/AiAssistant";
import { LicenseSetupWizard } from "@/components/LicenseSetupWizard";
import { useAuth } from "@/contexts/AuthContext";

// Routes that require a specific permission — mirrors Sidebar route map.
// Any path that starts with a pattern AND the user lacks the permission triggers
// a redirect to /dashboard.
const ROUTE_PERMISSIONS: { pattern: string; permission: string }[] = [
    { pattern: "/analytics",          permission: "VIEW_REPORTS" },
    { pattern: "/reports",            permission: "VIEW_REPORTS" },
    { pattern: "/organisations",      permission: "MANAGE_ORGANIZATION_SETTINGS" },
    { pattern: "/departments",        permission: "MANAGE_ORGANIZATION_SETTINGS" },
    { pattern: "/locations",          permission: "VIEW_LOCATIONS" },
    { pattern: "/users",              permission: "VIEW_USERS" },
    { pattern: "/roles",              permission: "VIEW_ROLES" },
    { pattern: "/assets",             permission: "VIEW_ASSETS" },
    { pattern: "/categories",         permission: "VIEW_CATEGORIES" },
    { pattern: "/maintenance",        permission: "VIEW_MAINTENANCE" },
    { pattern: "/transfers",          permission: "TRANSFER_ASSET" },
    { pattern: "/disposals",          permission: "DISPOSE_ASSET" },
    { pattern: "/audits",             permission: "VIEW_AUDIT_LOGS" },
    { pattern: "/suppliers",          permission: "VIEW_SUPPLIERS" },
    { pattern: "/purchase-orders",    permission: "VIEW_PROCUREMENT" },
    { pattern: "/contracts",          permission: "VIEW_CONTRACTS" },
    { pattern: "/budgets",            permission: "VIEW_BUDGETS" },
    { pattern: "/vendor-reviews",     permission: "VIEW_VENDOR_REVIEWS" },
    { pattern: "/licenses",           permission: "VIEW_SOFTWARE_LICENSES" },
    { pattern: "/compliance",         permission: "VIEW_COMPLIANCE" },
    { pattern: "/discovery",          permission: "VIEW_NETWORK_DISCOVERY" },
    { pattern: "/cloud-assets",       permission: "VIEW_CLOUD_ASSETS" },
    { pattern: "/ai-insights",        permission: "VIEW_ASSETS" },
    { pattern: "/sso-configuration",  permission: "MANAGE_ORGANIZATION_SETTINGS" },
    { pattern: "/webhooks",           permission: "MANAGE_ORGANIZATION_SETTINGS" },
    { pattern: "/billing",            permission: "MANAGE_ORGANIZATION_SETTINGS" },
    { pattern: "/audit-events",       permission: "REVIEW_ACCESS" },
    { pattern: "/health",             permission: "MANAGE_ORGANIZATION_SETTINGS" },
    { pattern: "/depreciation-policies", permission: "VIEW_DEPRECIATION" },
];

// Inner layout — can safely use useCurrency + usePermissions since it's inside both providers
function AppLayoutInner({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isBootstrappingAuth, setIsBootstrappingAuth] = useState(false);
    const [orgName, setOrgName] = useState<string>("AssetIQ");
    const [userRole, setUserRole] = useState<string>("ROLE_USER");
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [isPlanLimitOpen, setIsPlanLimitOpen] = useState(false);
    const [planLimitMessage, setPlanLimitMessage] = useState("");

    const { currency, setCurrency } = useCurrency();
    const { loading: permLoading, hasPermission } = usePermissions();
    const { isAuthenticated, isReady } = useAuth();

    const publicPaths = ["/", "/login", "/register", "/register-tenant", "/forgot-password", "/reset-password", "/design"];
    const isPublicPage = publicPaths.includes(pathname);
    const breadcrumb = pathname.split("/").filter(Boolean).join(" / ") || "home";
    const requiresOrgBootstrap =
        typeof window !== "undefined"
        && isMounted
        && !isPublicPage
        && isAuthenticated
        && !getOrganisationIdFromStorage();

    useEffect(() => {
        if (!isMounted || isPublicPage || !isAuthorized) return;

        let isActive = true;

        const bootstrapAuthContext = async () => {
            setIsBootstrappingAuth(true);

            const storedUser = getStoredUser();
            const cachedOrgName = extractOrganisationName(storedUser);
            if (cachedOrgName) setOrgName(cachedOrgName);
            if (typeof storedUser?.role === "string" && storedUser.role) {
                setUserRole(storedUser.role);
            }

            let resolvedOrgId = getOrganisationIdFromStorage();

            try {
                const profile = await authService.getProfile();
                if (!isActive) return;

                const mergedUser = mergeStoredUser(profile) ?? storedUser;
                const profileOrgId = verifyOrganisationContext(profile);
                resolvedOrgId = profileOrgId || resolvedOrgId;

                if (typeof mergedUser?.role === "string" && mergedUser.role) {
                    setUserRole(mergedUser.role);
                }

                const profileOrgName = extractOrganisationName(profile);
                if (profileOrgName) {
                    setOrgName(profileOrgName);
                }
            } catch (error) {
                console.error("Failed to hydrate profile for layout:", error);
            }

            if (!isActive) return;

            if (resolvedOrgId) {
                try {
                    const org = await organisationService.get(resolvedOrgId);
                    if (!isActive) return;

                    setOrgName(org.name);
                    mergeStoredUser({
                        organisationId: resolvedOrgId,
                        organisationName: org.name,
                    });
                } catch (error) {
                    console.error("Failed to fetch org name for layout:", error);
                }
            }

            if (isActive) {
                setIsBootstrappingAuth(false);
            }
        };

        bootstrapAuthContext();
        return () => {
            isActive = false;
        };
    }, [isAuthorized, isMounted, isPublicPage]);

    useEffect(() => {
        const loadSubscription = async () => {
            if (!isAuthorized || isPublicPage || isBootstrappingAuth || !getOrganisationIdFromStorage()) return;
            try {
                const sub = await billingService.getSubscription();
                setSubscription(sub);
            } catch {
                // Billing may not be configured in all environments.
            }
        };
        loadSubscription();
    }, [isAuthorized, isBootstrappingAuth, isPublicPage, pathname]);

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isMounted || !isReady) return;
        if (!isAuthenticated && !isPublicPage) {
            setIsAuthorized(false);
            setIsBootstrappingAuth(false);
            router.push("/login");
        } else {
            setIsAuthorized(isAuthenticated);
            setIsBootstrappingAuth(isAuthenticated && !isPublicPage && !getOrganisationIdFromStorage());
        }
    }, [pathname, router, isPublicPage, isMounted, isReady, isAuthenticated]);

    useEffect(() => {
        const onPlanLimit = (event: Event) => {
            const detail = (event as CustomEvent<{ message?: string }>).detail;
            setPlanLimitMessage(detail?.message || "You have reached your plan limits.");
            setIsPlanLimitOpen(true);
        };
        window.addEventListener("plan-limit-error", onPlanLimit as EventListener);
        return () => window.removeEventListener("plan-limit-error", onPlanLimit as EventListener);
    }, []);

    // After permissions load, redirect away from any page this user isn't allowed to see.
    // This covers direct URL entry, page refresh, and Ctrl+K quick navigation.
    useEffect(() => {
        if (permLoading || isBootstrappingAuth || requiresOrgBootstrap || isPublicPage || !isAuthorized) return;
        const match = ROUTE_PERMISSIONS.find(r => pathname.startsWith(r.pattern));
        if (match && !hasPermission(match.permission)) {
            router.replace("/dashboard");
        }
    }, [permLoading, isBootstrappingAuth, requiresOrgBootstrap, pathname, isPublicPage, isAuthorized, hasPermission, router]);

    if (!isMounted) return null;
    if (!isAuthorized && !isPublicPage) return null;
    if (isPublicPage) return <>{children}</>;

    // Block the entire authenticated shell while permissions are being fetched.
    // This closes the race-condition window where users could click restricted
    // sidebar items or search results before permission data arrives.
    if (permLoading || isBootstrappingAuth || requiresOrgBootstrap) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3 text-muted-fg">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    <span className="text-xs font-medium tracking-wide">Loading workspace…</span>
                </div>
            </div>
        );
    }

    const assetUsagePercent = subscription?.plan?.maxAssets
        ? Math.round((subscription.currentAssetCount / subscription.plan.maxAssets) * 100)
        : 0;
    const employeeUsagePercent = subscription?.plan?.maxEmployees
        ? Math.round((subscription.currentEmployeeCount / subscription.plan.maxEmployees) * 100)
        : 0;
    const showUsageWarning = Math.max(assetUsagePercent, employeeUsagePercent) >= 80;

    return (
        <div className="ea-shell-gradient flex h-screen overflow-hidden bg-background">
            <div className="hidden md:block">
                <Sidebar />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex h-14 items-center justify-between border-b border-edge bg-surface px-4 md:px-6">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="md:hidden font-bold text-lg text-brand truncate">{orgName}</span>
                        <div className="hidden md:block">
                            <p className="text-[10px] uppercase tracking-[0.1em] text-faint-fg">Workspace</p>
                            <p className="text-sm font-semibold text-foreground truncate">{breadcrumb}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <GlobalSearch />

                        {/* Currency switcher */}
                        <div className="flex items-center rounded-control border border-edge bg-surface-muted p-0.5">
                            {(["USD", "GHS"] as const).map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCurrency(c)}
                                    title={c === "USD" ? "US Dollar" : "Ghana Cedi"}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                                        currency === c
                                            ? "bg-brand text-brand-contrast shadow-sm"
                                            : "text-muted-fg hover:text-foreground"
                                    }`}
                                >
                                    {c === "USD" ? "$ USD" : "₵ GHS"}
                                </button>
                            ))}
                        </div>

                        <ThemeToggle />
                        <Button variant="outline" size="icon" aria-label="Notifications">
                            <Bell className="h-4 w-4" />
                        </Button>
                        <div className="hidden md:flex items-center gap-2 rounded-control border border-edge bg-surface-muted px-3 py-1.5">
                            <span className="h-2 w-2 rounded-full bg-brand" />
                            <span className="text-xs font-semibold text-foreground truncate max-w-[170px]">{orgName}</span>
                            <span className="text-[10px] uppercase tracking-wide text-muted-fg">{userRole.replace("ROLE_", "")}</span>
                        </div>
                    </div>
                </header>
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    {showUsageWarning && pathname !== "/billing" ? (
                        <div className="mb-4 rounded-card border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-foreground">
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
                    <p className="text-sm text-muted-fg">{planLimitMessage || "Upgrade your plan to continue this operation."}</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsPlanLimitOpen(false)}>Close</Button>
                        <Button onClick={() => { setIsPlanLimitOpen(false); router.push("/billing"); }}>Upgrade Plan</Button>
                    </div>
                </div>
            </Modal>
            <AiAssistant />
        </div>
    );
}

// Outer wrapper — provides currency context and permissions to the entire app shell
export function AppLayoutClient({ children }: { children: React.ReactNode }) {
    return (
        // LicenseProvider wraps everything but is a no-op in cloud mode —
        // it makes zero API calls and adds zero overhead when
        // NEXT_PUBLIC_APP_MODE=cloud (the default).
        <QueryProvider>
        <LicenseProvider>
            {/* Banner is a no-op in cloud mode — renders null */}
            <LicenseBanner />
            <CurrencyProvider>
                <PermissionProvider>
                    <AppLayoutInner>{children}</AppLayoutInner>
                    <ConfirmDialogHost />
                    {/* First-run wizard: shown in standalone mode when no key is active.
                        No-op (renders null) in cloud mode and after key activation. */}
                    <LicenseSetupWizard />
                </PermissionProvider>
            </CurrencyProvider>
        </LicenseProvider>
        </QueryProvider>
    );
}
