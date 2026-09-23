"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { matchesRoute, PUBLIC_PATHS } from "@/lib/route-path";
import { loginPathWithNext } from "@/lib/safe-next";
import { PageSpinner } from "@/components/ui/spinner";
import { Sidebar } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { QueryProvider } from "@/components/QueryProvider";
import { usePlanLimitNotices } from "@/components/billing/planLimitNotice";
import { formatPlanLimit, isUnlimitedLimit } from "@/features/billing/lib";
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
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { CurrencySwitcher } from "@/components/currency/CurrencySwitcher";
import { PermissionProvider, usePermissions } from "@/contexts/PermissionContext";
import { LicenseProvider } from "@/contexts/LicenseContext";
import { LicenseBanner } from "@/components/LicenseBanner";
import { ConfirmDialogHost } from "@/hooks/useConfirm";
import { StepUpMfaDialog } from "@/components/security/StepUpMfaDialog";
import { AiAssistant } from "@/components/AiAssistant";
import { LicenseSetupWizard } from "@/components/LicenseSetupWizard";
import { useAuth } from "@/contexts/AuthContext";
import { commercialFeatures, isCommercialRouteDisabled } from "@/config/commercialFeatures";

// Routes that require a specific permission — mirrors Sidebar route map.
// Any path that starts with a pattern AND the user lacks the permission triggers
// a redirect to /dashboard.
const ROUTE_PERMISSIONS: { pattern: string; permission: string }[] = [
    { pattern: "/analytics",          permission: "VIEW_REPORTS" },
    { pattern: "/operations",         permission: "VIEW_ASSETS" },
    { pattern: "/reports",            permission: "VIEW_REPORTS" },
    { pattern: "/organisations",      permission: "MANAGE_ORGANIZATION_SETTINGS" },
    { pattern: "/departments",        permission: "VIEW_DEPARTMENTS" },
    { pattern: "/locations",          permission: "VIEW_LOCATIONS" },
    { pattern: "/employees",          permission: "VIEW_EMPLOYEES" },
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
    { pattern: "/expenses",           permission: "MANAGE_EXPENSES" },
    { pattern: "/leases",             permission: "MANAGE_LEASES" },
    { pattern: "/exchange-rates",     permission: "MANAGE_EXCHANGE_RATES" },
    { pattern: "/vendor-reviews",     permission: "VIEW_VENDOR_REVIEWS" },
    { pattern: "/licenses",           permission: "VIEW_SOFTWARE_LICENSES" },
    { pattern: "/compliance",         permission: "VIEW_COMPLIANCE" },
    { pattern: "/dpa",                permission: "VIEW_COMPLIANCE" },
    { pattern: "/discovery",          permission: "VIEW_NETWORK_DISCOVERY" },
    { pattern: "/cloud-assets",       permission: "VIEW_CLOUD_ASSETS" },
    { pattern: "/ai-insights",        permission: "VIEW_ASSETS" },
    { pattern: "/sso-configuration",  permission: "MANAGE_ORGANIZATION_SETTINGS" },
    { pattern: "/webhooks",           permission: "MANAGE_ORGANIZATION_SETTINGS" },
    { pattern: "/billing",            permission: "MANAGE_ORGANIZATION_SETTINGS" },
    { pattern: "/audit-events",       permission: "VIEW_AUDIT_LOGS" },
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

    const { loading: permLoading, hasPermission } = usePermissions();
    const { isAuthenticated, isReady } = useAuth();

    const isPublicPage = matchesRoute(pathname, [...PUBLIC_PATHS]);
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
        const timer = window.setTimeout(() => {
            if (!isAuthenticated && !isPublicPage) {
                setIsAuthorized(false);
                setIsBootstrappingAuth(false);
                router.push(loginPathWithNext(`${window.location.pathname}${window.location.search}`));
            } else {
                setIsAuthorized(isAuthenticated);
                setIsBootstrappingAuth(isAuthenticated && !isPublicPage && !getOrganisationIdFromStorage());
            }
        }, 0);
        return () => window.clearTimeout(timer);
    }, [pathname, router, isPublicPage, isMounted, isReady, isAuthenticated]);

    // Plan-limit 403s are a nudge, never a blocking modal: a toast with an
    // Upgrade link, or (analytics) an inline card rendered by the page itself.
    usePlanLimitNotices();

    // After permissions load, redirect away from any page this user isn't allowed to see.
    // This covers direct URL entry, page refresh, and Ctrl+K quick navigation.
    useEffect(() => {
        if (permLoading || isBootstrappingAuth || requiresOrgBootstrap || isPublicPage || !isAuthorized) return;
        if (isCommercialRouteDisabled(pathname)) {
            router.replace("/dashboard");
            return;
        }
        const match = ROUTE_PERMISSIONS.find(r => pathname.startsWith(r.pattern));
        if (match && !hasPermission(match.permission)) {
            router.replace("/dashboard");
        }
    }, [permLoading, isBootstrappingAuth, requiresOrgBootstrap, pathname, isPublicPage, isAuthorized, hasPermission, router]);

    // Neither of these branches may return null.
    //
    // They both used to, and it made every failure in the app look identical: a
    // white page with nothing on it. Two separate bugs presented that way in one
    // day — a route-matching regression that classified the login page as private,
    // and an ordinary logged-out visit to /dashboard — and in both cases the only
    // clue was a 403 in the network tab. A blank document is indistinguishable from
    // a crash, so it sends you looking for a JavaScript error that does not exist.
    //
    // Rendering something, always, means an auth problem shows up as an auth
    // problem.

    // Auth state has not resolved yet. Normally a few hundred milliseconds.
    //
    // This branch is also what `next build` prerenders into every exported
    // HTML file, 404.html included: every page in this app is a client
    // component, so the static document can only ever contain the shell's
    // pre-hydration state. A visitor to a bad URL therefore sees this before
    // the 404 copy appears — for exactly as long as the JS bundle takes, the
    // same as any other page. Giving the 404 its own prerendered document
    // would mean a second root layout outside this client auth shell, which
    // is a restructure out of proportion to a sub-second spinner.
    //
    // What it costs nothing to fix is the silence: an unlabelled spinner tells
    // a screen reader nothing and tells a user on a slow link nothing either.
    if (!isMounted || !isReady) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <PageSpinner label="Loading AssetIQ…" />
            </div>
        );
    }

    // Signed out on a private route. The effect above pushes to /login; this is
    // what renders in the meantime, and — more importantly — what renders if that
    // push ever fails to fire. The link is the escape hatch: whatever goes wrong
    // with the redirect, the user still lands somewhere they can act on.
    if (!isAuthorized && !isPublicPage) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                    You need to sign in to view this page.
                </p>
                <Link
                    href={loginPathWithNext(`${pathname}${typeof window === "undefined" ? "" : window.location.search}`)}
                    className="text-sm font-medium underline underline-offset-4"
                >
                    Go to sign in
                </Link>
            </div>
        );
    }

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

    const assetUsagePercent = subscription?.plan?.maxAssets && !isUnlimitedLimit(subscription.plan.maxAssets)
        ? Math.round((subscription.currentAssetCount / subscription.plan.maxAssets) * 100)
        : 0;
    const employeeUsagePercent = subscription?.plan?.maxEmployees && !isUnlimitedLimit(subscription.plan.maxEmployees)
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

                        {/* Display-currency switcher: the org's base currency plus every
                            currency reachable from it through exchange rates. */}
                        <CurrencySwitcher />

                        <ThemeToggle />
                        <NotificationBell />
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
                            Plan usage warning: assets {subscription?.currentAssetCount}/{formatPlanLimit(subscription?.plan?.maxAssets)} ({assetUsagePercent}%), employees {subscription?.currentEmployeeCount}/{formatPlanLimit(subscription?.plan?.maxEmployees)} ({employeeUsagePercent}%).
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

            {commercialFeatures.governedAi ? <AiAssistant /> : null}
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
                    {/* Step-up MFA prompt for approvals and admin writes; opened by the axios interceptor. */}
                    <StepUpMfaDialog />
                    {/* First-run wizard: shown in standalone mode when no key is active.
                        No-op (renders null) in cloud mode and after key activation. */}
                    <LicenseSetupWizard />
                </PermissionProvider>
            </CurrencyProvider>
        </LicenseProvider>
        </QueryProvider>
    );
}
