"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        // Paths that don't require authentication
        const publicPaths = ["/login", "/register"];

        const checkAuth = () => {
            const token = localStorage.getItem("token");
            if (!token && !publicPaths.includes(pathname)) {
                // If no token and trying to access protected route, redirect to login
                setIsAuthorized(false);
                router.push("/login");
            } else {
                setIsAuthorized(true);
            }
        };

        checkAuth();
    }, [pathname, router]);

    // Show nothing while checking auth to prevent flicker of dashboard
    if (!isAuthorized) {
        return null;
    }

    return <>{children}</>;
}
