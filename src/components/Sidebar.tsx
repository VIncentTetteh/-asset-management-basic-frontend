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
} from "lucide-react";
import { organisationService } from "@/services/organisationService";
import { usePermissions } from "@/contexts/PermissionContext";
import { User } from "@/types";

export function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const [orgName, setOrgName] = useState<string>("AssetMaster");
    const { hasPermission, loading: permLoading } = usePermissions();

    useEffect(() => {
        const loadOrgName = async () => {
            try {
                const storedUserStr = localStorage.getItem("user");
                if (storedUserStr) {
                    const user = JSON.parse(storedUserStr) as User;
                    if (user.organisationId) {
                        const orgs = await organisationService.getAll();
                        if (orgs.length > 0) {
                            setOrgName(orgs[0].name);
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to load org name in sidebar:", error);
            }
        };
        loadOrgName();
    }, []);

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
            group: "Organization",
            items: [
                { href: "/organisations", label: "Organisations", icon: Building2, active: pathname.startsWith("/organisations"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
                { href: "/departments", label: "Departments", icon: Layers, active: pathname.startsWith("/departments"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
                { href: "/locations", label: "Locations", icon: MapPin, active: pathname.startsWith("/locations"), permission: "VIEW_LOCATIONS" },
            ]
        },
        {
            group: "Access Control",
            items: [
                { href: "/users", label: "Users", icon: Users, active: pathname.startsWith("/users"), permission: "VIEW_USERS" },
                { href: "/roles", label: "Roles", icon: Shield, active: pathname.startsWith("/roles"), permission: "VIEW_ROLES" },
                { href: "/profile", label: "My Profile", icon: UserCircle, active: pathname.startsWith("/profile") }
            ]
        },
        {
            group: "Asset Lifecycle",
            items: [
                { href: "/assets", label: "All Assets", icon: Hexagon, active: pathname.startsWith("/assets"), permission: "VIEW_ASSETS" },
                { href: "/categories", label: "Categories", icon: Tags, active: pathname.startsWith("/categories"), permission: "VIEW_CATEGORIES" },
                { href: "/maintenance", label: "Maintenance", icon: Wrench, active: pathname.startsWith("/maintenance"), permission: "VIEW_MAINTENANCE" },
                { href: "/transfers", label: "Transfers", icon: ArrowRightLeft, active: pathname.startsWith("/transfers"), permission: "VIEW_TRANSFERS" },
                { href: "/disposals", label: "Disposals", icon: Trash2, active: pathname.startsWith("/disposals"), permission: "VIEW_DISPOSALS" },
                { href: "/audits", label: "Audits", icon: ClipboardCheck, active: pathname.startsWith("/audits"), permission: "VIEW_AUDITS" },
            ]
        },
        {
            group: "Procurement",
            items: [
                { href: "/suppliers", label: "Suppliers", icon: Truck, active: pathname.startsWith("/suppliers"), permission: "VIEW_SUPPLIERS" },
                { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart, active: pathname.startsWith("/purchase-orders"), permission: "VIEW_PROCUREMENT" },
                { href: "/contracts", label: "Contracts", icon: FileSignature, active: pathname.startsWith("/contracts"), permission: "VIEW_CONTRACTS" },
                { href: "/budgets", label: "Budgets", icon: Wallet, active: pathname.startsWith("/budgets"), permission: "VIEW_BUDGETS" },
                { href: "/vendor-reviews", label: "Vendor Reviews", icon: Star, active: pathname.startsWith("/vendor-reviews"), permission: "VIEW_VENDOR_REVIEWS" },
            ]
        },
        {
            group: "Software & Licensing",
            items: [
                { href: "/licenses", label: "Software Licenses", icon: Key, active: pathname.startsWith("/licenses"), permission: "VIEW_SOFTWARE_LICENSES" },
            ]
        },
        {
            group: "Compliance",
            items: [
                { href: "/compliance/controls", label: "Controls", icon: ShieldCheck, active: pathname.startsWith("/compliance/controls"), permission: "VIEW_COMPLIANCE" },
                { href: "/compliance/bog-controls", label: "BOG Controls", icon: Building2, active: pathname.startsWith("/compliance/bog-controls"), permission: "VIEW_COMPLIANCE" },
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
            ]
        },
        {
            group: "Infrastructure",
            items: [
                { href: "/discovery", label: "Asset Discovery", icon: ScanLine, active: pathname.startsWith("/discovery"), permission: "VIEW_NETWORK_DISCOVERY" },
                { href: "/cloud-assets", label: "Cloud Assets", icon: Cloud, active: pathname.startsWith("/cloud-assets"), permission: "VIEW_CLOUD_ASSETS" },
                { href: "/ai-insights", label: "AI Insights", icon: Brain, active: pathname.startsWith("/ai-insights"), permission: "VIEW_ASSETS" },
            ]
        },
        {
            group: "System Config",
            items: [
                { href: "/sso-configuration", label: "SSO Configuration", icon: KeyRound, active: pathname.startsWith("/sso-configuration"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
                { href: "/webhooks", label: "Webhooks", icon: Webhook, active: pathname.startsWith("/webhooks"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
                { href: "/notifications", label: "Notifications", icon: Bell, active: pathname.startsWith("/notifications") },
                { href: "/billing", label: "Billing", icon: CreditCard, active: pathname.startsWith("/billing"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
                { href: "/audit-events", label: "Audit Events", icon: Shield, active: pathname.startsWith("/audit-events"), permission: "REVIEW_ACCESS" },
                { href: "/health", label: "System Health", icon: Activity, active: pathname.startsWith("/health"), permission: "MANAGE_ORGANIZATION_SETTINGS" },
            ]
        }
    ];

    // Filter routes based on current user's permissions.
    // Items without a permission field are always visible.
    // While permissions are loading, render nothing — the AppLayoutClient already
    // shows a full-page spinner, so the sidebar never reaches this branch.
    // The empty fallback is purely defensive (e.g., a mid-session permission refresh).
    const routes = permLoading
        ? []
        : allRoutes.map((group) => ({
              ...group,
              items: group.items.filter(
                  (item) => !item.permission || hasPermission(item.permission)
              ),
          })).filter((group) => group.items.length > 0);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/login");
    };

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 hidden md:flex flex-col h-full overflow-y-auto">
            <div className="p-6">
                <Link href="/dashboard" className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center shrink-0">
                        <span className="text-white font-black text-[10px] select-none">IQ</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-black text-white leading-none">Asset<span className="text-teal-400">IQ</span></p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{orgName}</p>
                    </div>
                </Link>
            </div>

            <nav className="flex-1 px-4 pb-4 space-y-6">
                {routes.map((routeGroup, i) => (
                    <div key={i} className="space-y-1">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 px-3">
                            {routeGroup.group}
                        </h4>
                        {routeGroup.items.map((route) => (
                            <Link
                                key={route.href}
                                href={route.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                                    route.active
                                        ? "bg-emerald-600/10 text-emerald-400"
                                        : "hover:bg-slate-800 hover:text-white"
                                )}
                            >
                                <route.icon className="h-4 w-4" />
                                {route.label}
                            </Link>
                        ))}
                    </div>
                ))}
            </nav>
            <div className="p-4 border-t border-slate-800">
                <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                >
                    Logout
                </button>
            </div>
        </aside>
    );
}
