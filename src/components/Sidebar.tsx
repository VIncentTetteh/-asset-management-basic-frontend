"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Building2,
    LayoutGrid,
    Layers,
    Hexagon,
    Users,
    Shield,
    MapPin,
    Truck,
    ShoppingCart,
    Wrench,
    ClipboardCheck,
    ArrowRightLeft,
    Trash2,
    UserCircle,
    Tags,
    BarChart3,
    FileText,
    Webhook,
    Bell,
    Activity,
    CreditCard,
    ShieldCheck,
    AlertTriangle,
    Siren,
    Network,
    Cpu,
    PackageCheck,
    ScanLine,
    FileClock,
    TrendingUp,
    Key,
    FileSignature,
    Wallet,
    Star,
    KeyRound,
    Cloud,
    Brain,
    Receipt,
    Home,
    Calculator,
    DollarSign,
    MessageSquare,
    UserCheck,
    BarChart2,
    LogOut,
} from "lucide-react";
import { organisationService } from "@/services/organisationService";
import { usePermissions } from "@/contexts/PermissionContext";
import { useLicenseStatus } from "@/contexts/LicenseContext";
import {
    clearVerifiedOrganisationId,
    extractOrganisationName,
    getOrganisationIdFromStorage,
    getStoredUser,
} from "@/lib/authContext";
import { authService } from "@/services/authService";

export function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const [orgName, setOrgName] = useState<string>("AssetIQ");
    const { hasPermission, loading: permLoading } = usePermissions();
    const { status: licenseStatus } = useLicenseStatus();

    useEffect(() => {
        const loadOrgName = async () => {
            try {
                const storedUser = getStoredUser();
                const cachedOrgName = extractOrganisationName(storedUser);
                if (cachedOrgName) {
                    setOrgName(cachedOrgName);
                }

                const orgId = getOrganisationIdFromStorage();
                if (!orgId) return;

                const org = await organisationService.get(orgId);
                setOrgName(org.name);
            } catch (error) {
                console.error("Failed to load org name in sidebar:", error);
            }
        };
        loadOrgName();
    }, []);

    // The 7-section information architecture. Items without a permission
    // field are always visible.
    const allRoutes = [
        {
            group: "Overview",
            items: [
                { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, active: pathname.startsWith("/dashboard") },
                { href: "/analytics", label: "Analytics", icon: BarChart3, active: pathname.startsWith("/analytics"), permission: "VIEW_REPORTS" },
                { href: "/reports", label: "Reports", icon: FileText, active: pathname.startsWith("/reports"), permission: "VIEW_REPORTS" },
            ]
        },
        {
            group: "Assets & Operations",
            items: [
                { href: "/assets", label: "Assets", icon: Hexagon, active: pathname.startsWith("/assets"), permission: "VIEW_ASSETS" },
                { href: "/categories", label: "Categories", icon: Tags, active: pathname.startsWith("/categories"), permission: "VIEW_CATEGORIES" },
                { href: "/checkouts", label: "Checkouts", icon: PackageCheck, active: pathname.startsWith("/checkouts"), permission: "VIEW_ASSETS" },
                { href: "/maintenance", label: "Maintenance", icon: Wrench, active: pathname.startsWith("/maintenance"), permission: "VIEW_MAINTENANCE" },
                { href: "/transfers", label: "Transfers", icon: ArrowRightLeft, active: pathname.startsWith("/transfers"), permission: "VIEW_TRANSFERS" },
                { href: "/disposals", label: "Disposals", icon: Trash2, active: pathname.startsWith("/disposals"), permission: "VIEW_DISPOSALS" },
                { href: "/audits", label: "Audits", icon: ClipboardCheck, active: pathname.startsWith("/audits"), permission: "VIEW_AUDITS" },
                { href: "/discovery", label: "Asset Discovery", icon: ScanLine, active: pathname.startsWith("/discovery"), permission: "VIEW_NETWORK_DISCOVERY" },
                { href: "/cloud-assets", label: "Cloud Assets", icon: Cloud, active: pathname.startsWith("/cloud-assets"), permission: "VIEW_CLOUD_ASSETS" },
            ]
        },
        {
            group: "People",
            items: [
                { href: "/users", label: "Users", icon: Users, active: pathname.startsWith("/users"), permission: "VIEW_USERS" },
                { href: "/roles", label: "Roles", icon: Shield, active: pathname.startsWith("/roles"), permission: "VIEW_ROLES" },
                { href: "/departments", label: "Departments", icon: Layers, active: pathname.startsWith("/departments"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
                { href: "/profile", label: "My Profile", icon: UserCircle, active: pathname.startsWith("/profile") },
            ]
        },
        {
            group: "Finance & Procurement",
            items: [
                { href: "/suppliers", label: "Suppliers", icon: Truck, active: pathname.startsWith("/suppliers"), permission: "VIEW_SUPPLIERS" },
                { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart, active: pathname.startsWith("/purchase-orders"), permission: "VIEW_PROCUREMENT" },
                { href: "/contracts", label: "Contracts", icon: FileSignature, active: pathname.startsWith("/contracts"), permission: "VIEW_CONTRACTS" },
                { href: "/budgets", label: "Budgets", icon: Wallet, active: pathname.startsWith("/budgets"), permission: "VIEW_BUDGETS" },
                { href: "/expenses", label: "Expenses", icon: Receipt, active: pathname.startsWith("/expenses"), permission: "VIEW_BUDGETS" },
                { href: "/leases", label: "Lease Records", icon: Home, active: pathname.startsWith("/leases"), permission: "VIEW_CONTRACTS" },
                { href: "/vendor-reviews", label: "Vendor Reviews", icon: Star, active: pathname.startsWith("/vendor-reviews"), permission: "VIEW_VENDOR_REVIEWS" },
                { href: "/licenses", label: "Software Licenses", icon: Key, active: pathname.startsWith("/licenses"), permission: "VIEW_SOFTWARE_LICENSES" },
                { href: "/depreciation-policies", label: "Depreciation", icon: Calculator, active: pathname.startsWith("/depreciation-policies"), permission: "VIEW_DEPRECIATION" },
                { href: "/exchange-rates", label: "Exchange Rates", icon: DollarSign, active: pathname.startsWith("/exchange-rates"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
            ]
        },
        {
            group: "Compliance",
            items: [
                { href: "/compliance/controls", label: "Controls", icon: ShieldCheck, active: pathname.startsWith("/compliance/controls"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/bog-controls", label: "BoG Controls", icon: Building2, active: pathname.startsWith("/compliance/bog-controls"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/bog-report", label: "BoG Report", icon: BarChart2, active: pathname.startsWith("/compliance/bog-report"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/risks", label: "Risk Register", icon: AlertTriangle, active: pathname.startsWith("/compliance/risks"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/incidents", label: "Incidents", icon: Siren, active: pathname.startsWith("/compliance/incidents"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/policies", label: "Policies", icon: FileText, active: pathname.startsWith("/compliance/policies"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/security-zones", label: "Security Zones", icon: Network, active: pathname.startsWith("/compliance/security-zones"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/ics-assets", label: "ICS Assets", icon: Cpu, active: pathname.startsWith("/compliance/ics-assets"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/patch-records", label: "Patch Records", icon: PackageCheck, active: pathname.startsWith("/compliance/patch-records"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/pci-saq", label: "PCI-DSS SAQ", icon: CreditCard, active: pathname.startsWith("/compliance/pci-saq"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/sla-metrics", label: "SLA Metrics", icon: TrendingUp, active: pathname.startsWith("/compliance/sla-metrics"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/vulnerability-scans", label: "Vuln Scans", icon: ScanLine, active: pathname.startsWith("/compliance/vulnerability-scans"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/regulatory-filings", label: "Reg. Filings", icon: FileClock, active: pathname.startsWith("/compliance/regulatory-filings"), permission: "VIEW_COMPLIANCE" },
                { href: "/dpa/consent", label: "DPA Consent", icon: UserCheck, active: pathname.startsWith("/dpa/consent"), permission: "VIEW_COMPLIANCE" },
                { href: "/dpa/dsar", label: "DSAR Requests", icon: FileText, active: pathname.startsWith("/dpa/dsar"), permission: "VIEW_COMPLIANCE" },
            ]
        },
        {
            group: "Insights & AI",
            items: [
                { href: "/ai-insights", label: "AI Insights", icon: Brain, active: pathname.startsWith("/ai-insights"), permission: "VIEW_ASSETS" },
                { href: "/ai-chat", label: "AI Chat", icon: MessageSquare, active: pathname.startsWith("/ai-chat"), permission: "VIEW_ASSETS" },
            ]
        },
        {
            group: "Administration",
            items: [
                { href: "/organisations", label: "Organisations", icon: Building2, active: pathname.startsWith("/organisations"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
                { href: "/locations", label: "Locations", icon: MapPin, active: pathname.startsWith("/locations"), permission: "VIEW_LOCATIONS" },
                { href: "/sso-configuration", label: "SSO", icon: KeyRound, active: pathname.startsWith("/sso-configuration"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
                { href: "/settings/storage", label: "Storage", icon: Cloud, active: pathname.startsWith("/settings/storage"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
                { href: "/webhooks", label: "Webhooks", icon: Webhook, active: pathname.startsWith("/webhooks"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
                { href: "/notifications", label: "Notifications", icon: Bell, active: pathname.startsWith("/notifications") },
                { href: "/billing", label: "Billing", icon: CreditCard, active: pathname.startsWith("/billing"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
                { href: "/audit-events", label: "Audit Events", icon: Shield, active: pathname.startsWith("/audit-events"), permission: "REVIEW_ACCESS" },
                { href: "/health", label: "System Health", icon: Activity, active: pathname.startsWith("/health"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
                ...(licenseStatus.mode === "standalone" ? [{ href: "/settings/license", label: "License Key", icon: Key, active: pathname.startsWith("/settings/license"), permission: "MANAGE_ORGANIZATION_SETTINGS" as string }] : []),
            ]
        }
    ];

    // Filter routes based on current user's permissions.
    // While permissions are loading, render nothing — the AppLayoutClient already
    // shows a full-page spinner, so the sidebar never reaches this branch.
    const routes = permLoading
        ? []
        : allRoutes.map((group) => ({
              ...group,
              items: group.items.filter(
                  (item) => !item.permission || hasPermission(item.permission)
              ),
          })).filter((group) => group.items.length > 0);

    const handleLogout = async () => {
        try {
            await authService.logout();
        } catch {
            // Best-effort logout; clear local display state either way.
        }
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        clearVerifiedOrganisationId();
        // Reset PermissionContext so a subsequent login starts from a clean slate.
        window.dispatchEvent(new Event("auth-changed"));
        router.push("/login");
    };

    return (
        <aside className="hidden h-full w-60 flex-col overflow-y-auto border-r border-edge bg-surface text-muted-fg md:flex">
            <div className="px-5 pb-3 pt-5">
                <Link href="/dashboard" className="ea-focus flex items-center gap-2.5 rounded-sm">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand">
                        <span className="select-none text-[10px] font-black text-brand-contrast">IQ</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-black leading-none text-foreground">Asset<span className="text-brand">IQ</span></p>
                        <p className="mt-0.5 truncate text-xs text-muted-fg">{orgName}</p>
                    </div>
                </Link>
            </div>

            <nav className="flex-1 space-y-5 px-3 pb-4">
                {routes.map((routeGroup, i) => (
                    <div key={i} className="space-y-0.5">
                        <h4 className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-fg">
                            {routeGroup.group}
                        </h4>
                        {routeGroup.items.map((route) => (
                            <Link
                                key={route.href}
                                href={route.href}
                                className={cn(
                                    "ea-focus flex items-center gap-2.5 rounded-control py-1.5 pl-3 pr-3 text-[13px] font-medium transition-colors",
                                    route.active
                                        ? "-ml-px border-l-[3px] border-brand bg-brand-soft pl-[9px] font-bold text-brand"
                                        : "hover:bg-surface-sunken hover:text-foreground"
                                )}
                            >
                                <route.icon className="h-4 w-4 shrink-0" />
                                {route.label}
                            </Link>
                        ))}
                    </div>
                ))}
            </nav>
            <div className="border-t border-edge p-3">
                <button
                    type="button"
                    onClick={handleLogout}
                    className="ea-focus flex w-full items-center gap-2.5 rounded-control px-3 py-1.5 text-left text-[13px] font-medium transition-colors hover:bg-surface-sunken hover:text-foreground"
                >
                    <LogOut className="h-4 w-4" />
                    Log out
                </button>
            </div>
        </aside>
    );
}
