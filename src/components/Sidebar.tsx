"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    UserCircle
} from "lucide-react";

export function Sidebar() {
    const pathname = usePathname();

    const routes = [
        {
            group: "Overview",
            items: [
                { href: "/", label: "Dashboard", icon: LayoutGrid, active: pathname === "/" },
            ]
        },
        {
            group: "Organization",
            items: [
                { href: "/organisations", label: "Organisations", icon: Building2, active: pathname.startsWith("/organisations") },
                { href: "/departments", label: "Departments", icon: Layers, active: pathname.startsWith("/departments") },
                { href: "/locations", label: "Locations", icon: MapPin, active: pathname.startsWith("/locations") },
            ]
        },
        {
            group: "Access Control",
            items: [
                { href: "/users", label: "Users", icon: Users, active: pathname.startsWith("/users") },
                { href: "/roles", label: "Roles", icon: Shield, active: pathname.startsWith("/roles") },
                { href: "/profile", label: "My Profile", icon: UserCircle, active: pathname.startsWith("/profile") }
            ]
        },
        {
            group: "Asset Lifecycle",
            items: [
                { href: "/assets", label: "All Assets", icon: Hexagon, active: pathname.startsWith("/assets") },
                { href: "/maintenance", label: "Maintenance", icon: Wrench, active: pathname.startsWith("/maintenance") },
                { href: "/transfers", label: "Transfers", icon: ArrowRightLeft, active: pathname.startsWith("/transfers") },
                { href: "/disposals", label: "Disposals", icon: Trash2, active: pathname.startsWith("/disposals") },
                { href: "/audits", label: "Audits", icon: ClipboardCheck, active: pathname.startsWith("/audits") },
            ]
        },
        {
            group: "Procurement",
            items: [
                { href: "/suppliers", label: "Suppliers", icon: Truck, active: pathname.startsWith("/suppliers") },
                { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart, active: pathname.startsWith("/purchase-orders") },
            ]
        }
    ];

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 hidden md:flex flex-col h-full overflow-y-auto">
            <div className="p-6">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl text-emerald-400">
                    <Hexagon className="h-6 w-6" />
                    <span>AssetMaster</span>
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
                <Link href="/login" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
                    Logout
                </Link>
            </div>
        </aside>
    );
}
