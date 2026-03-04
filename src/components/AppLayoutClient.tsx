"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [orgName, setOrgName] = useState<string>("AssetMaster");

    useEffect(() => {
        const fetchOrg = async () => {
            const storedUserStr = localStorage.getItem("user");
            if (storedUserStr) {
                const user = JSON.parse(storedUserStr);
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

    const publicPaths = ["/login", "/register", "/register-tenant"];
    const isPublicPage = publicPaths.includes(pathname);

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
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <div className="hidden md:block">
                <Sidebar />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 border-b bg-white flex items-center px-6 shadow-sm md:hidden">
                    <span className="font-bold text-xl text-emerald-600 truncate">{orgName}</span>
                </header>
                <main className="flex-1 overflow-auto p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
