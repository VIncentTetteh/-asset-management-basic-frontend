"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ssoAuthService, SsoCallbackResponse } from "@/services/ssoAuthService";
import { authService } from "@/services/authService";
import api from "@/lib/axios";
import toast from "react-hot-toast";
import { Loader2, ShieldCheck } from "lucide-react";

export default function SsoCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<"processing" | "success" | "error">("processing");

    useEffect(() => {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const token = searchParams.get("token"); // In case the backend already exchanged it

        const handleCallback = async () => {
            try {
                let response: SsoCallbackResponse;

                if (token) {
                    // Backend already handled exchange and redirected with token
                    // We might still want to fetch user data if not provided
                    response = { token };
                } else if (code) {
                    response = await ssoAuthService.handleOAuth2Callback({ code, state: state || undefined });
                } else {
                    throw new Error("No authorization code or token found in URL");
                }

                if (response.token) {
                    localStorage.setItem("token", response.token);
                    api.defaults.headers.common["Authorization"] = `Bearer ${response.token}`;

                    // Store user — fetch from /auth/profile if the callback didn't include it
                    let user = response.user;
                    if (!user) {
                        try {
                            user = await authService.getProfile();
                        } catch {
                            // non-fatal — dashboard will fetch it independently
                        }
                    }
                    if (user) {
                        localStorage.setItem("user", JSON.stringify(user));
                    }

                    setStatus("success");
                    toast.success(response.message || "SSO login successful!");

                    // Small delay to show the success state
                    setTimeout(() => {
                        router.push("/dashboard");
                    }, 1500);
                } else {
                    throw new Error("Failed to retrieve authentication token");
                }
            } catch (error: any) {
                console.error("SSO Callback Error:", error);
                setStatus("error");
                toast.error(error.response?.data?.message || error.message || "SSO authentication failed");
                
                setTimeout(() => {
                    router.push("/login");
                }, 3000);
            }
        };

        handleCallback();
    }, [router, searchParams]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
            <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
                {status === "processing" && (
                    <div className="space-y-4">
                        <div className="relative mx-auto w-16 h-16">
                            <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-20" />
                            <div className="relative flex items-center justify-center w-16 h-16 bg-white rounded-full border-2 border-indigo-600 shadow-sm">
                                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                            </div>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Authenticating with SSO...</h1>
                        <p className="text-slate-500 text-sm">Please wait while we verify your credentials and secure your session.</p>
                    </div>
                )}

                {status === "success" && (
                    <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                        <div className="relative mx-auto w-16 h-16 flex items-center justify-center bg-emerald-100 rounded-full border-2 border-emerald-500 shadow-sm text-emerald-600">
                            <ShieldCheck className="h-8 w-8" />
                        </div>
                        <h1 className="text-xl font-bold text-emerald-900 tracking-tight">Login Successful!</h1>
                        <p className="text-slate-600 text-sm font-medium">Redirecting you to your dashboard...</p>
                    </div>
                )}

                {status === "error" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="relative mx-auto w-16 h-16 flex items-center justify-center bg-red-100 rounded-full border-2 border-red-500 shadow-sm text-red-600">
                            <span className="text-2xl font-bold">!</span>
                        </div>
                        <h1 className="text-xl font-bold text-red-900 tracking-tight">Authentication Failed</h1>
                        <p className="text-slate-600 text-sm">Something went wrong during the SSO flow. Navigating back to the login page...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
