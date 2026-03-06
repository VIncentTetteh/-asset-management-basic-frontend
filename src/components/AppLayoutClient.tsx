"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [orgName, setOrgName] = useState<string>("AssetMaster");
    const [userRole, setUserRole] = useState<string>("ROLE_USER");

    useEffect(() => {
        const fetchOrg = async () => {
            const storedUserStr = localStorage.getItem("user");
            if (storedUserStr) {
                const user = JSON.parse(storedUserStr);
                if (user?.role) setUserRole(user.role);
                if (user.organisationId) {
                    try {
                        const { organisationService } = await import("@/services/organisationService");
                        const org = await organisationService.get(user.organisationId);
                        setOrgName(org.name);
                    } catch (e) {
                        console.error("Failed to fetch org name for layout:", e);
                    }
                }
            }
        };
        if (isAuthorized) {
            fetchOrg();
        }
    }, [isAuthorized]);

    const publicPaths = ["/", "/login", "/register", "/register-tenant", "/forgot-password", "/reset-password"];
    const isPublicPage = publicPaths.includes(pathname);
    const breadcrumb = pathname.split("/").filter(Boolean).join(" / ") || "home";

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const checkAuth = () => {
            const token = localStorage.getItem("token");
            if (!token && !isPublicPage) {
                // If no token and trying to access protected route, redirect to login
                setIsAuthorized(false);
                router.push("/login");
            } else {
                setIsAuthorized(true);
            }
        };

        checkAuth();
    }, [pathname, router, isPublicPage, isMounted]);

    // Prevent hydration mismatch by not rendering until mounted
    if (!isMounted) {
        return null;
    }

    // Don't render protected content if not authorized
    if (!isAuthorized && !isPublicPage) {
        return null;
    }

    // If it's a public page (like login), don't show the Sidebar and styling wrapper
    if (isPublicPage) {
        return <>{children}</>;
    }

    // Authorized dashboard layout
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
                    {children}
                </main>
            </div>
        </div>
    );
}
