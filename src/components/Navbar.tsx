"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Building2, LayoutGrid, Layers, Hexagon } from "lucide-react";

export function Navbar() {
    const pathname = usePathname();

    const routes = [
        {
            href: "/",
            label: "Overview",
            icon: LayoutGrid,
            active: pathname === "/",
        },
        {
            href: "/organisations",
            label: "Organisations",
            icon: Building2,
            active: pathname.startsWith("/organisations"),
        },
        {
            href: "/departments",
            label: "Departments",
            icon: Layers,
            active: pathname.startsWith("/departments"),
        },
        {
            href: "/assets",
            label: "Assets",
            icon: Hexagon,
            active: pathname.startsWith("/assets"),
        },
    ];

    return (
        <nav className="border-b border-slate-200 bg-white">
            <div className="container mx-auto px-4">
                <div className="flex h-16 items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-600">
                            <Hexagon className="h-6 w-6" />
                            <span>AssetManager</span>
                        </Link>
                        <div className="flex items-center gap-1">
                            {routes.map((route) => (
                                <Link
                                    key={route.href}
                                    href={route.href}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                        route.active
                                            ? "bg-blue-50 text-blue-600"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    <route.icon className="h-4 w-4" />
                                    {route.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
