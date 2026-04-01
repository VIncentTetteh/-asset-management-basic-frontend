"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { authService } from "@/services/authService";
import { mfaService } from "@/services/mfaService";
import { ssoAuthService } from "@/services/ssoAuthService";
import api from "@/lib/axios";
import { Building2, Chrome, ShieldCheck, Smartphone } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActiveSsoConfig {
    enabled: boolean;
    provider?: string; // e.g. "GOOGLE", "AZURE_AD", "OKTA", "SAML"
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SSO_PROVIDER_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    GOOGLE: { label: "Google", icon: <Chrome className="mr-2 h-4 w-4" /> },
    AZURE_AD: { label: "Microsoft", icon: <Building2 className="mr-2 h-4 w-4" /> },
    OKTA: { label: "Okta", icon: <ShieldCheck className="mr-2 h-4 w-4" /> },
    SAML: { label: "Enterprise SAML", icon: <ShieldCheck className="mr-2 h-4 w-4 text-slate-500" /> },
    GITHUB: { label: "GitHub", icon: <ShieldCheck className="mr-2 h-4 w-4" /> },
    CUSTOM_OAUTH2: { label: "SSO", icon: <ShieldCheck className="mr-2 h-4 w-4" /> },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [ssoProvider, setSsoProvider] = useState("");

    // Dynamic SSO discovery
    const [activeSso, setActiveSso] = useState<ActiveSsoConfig | null>(null);
    const [ssoLoading, setSsoLoading] = useState(false);
    const orgIdDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // MFA challenge state
    const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
    const [mfaCode, setMfaCode] = useState("");
    const [isMfaSubmitting, setIsMfaSubmitting] = useState(false);

    const { register, handleSubmit, watch, formState: { errors } } = useForm();
    const orgIdValue = watch("organisationId");

    // ── SSO Discovery ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (orgIdDebounceRef.current) clearTimeout(orgIdDebounceRef.current);
        const trimmed = String(orgIdValue ?? "").trim();

        if (!UUID_RE.test(trimmed)) {
            setActiveSso(null);
            return;
        }

        orgIdDebounceRef.current = setTimeout(async () => {
            setSsoLoading(true);
            try {
                const res = await api.get<ActiveSsoConfig>("/auth/sso/public", {
                    params: { orgId: trimmed },
                });
                setActiveSso(res.data);
            } catch {
                setActiveSso(null);
            } finally {
                setSsoLoading(false);
            }
        }, 500);

        return () => {
            if (orgIdDebounceRef.current) clearTimeout(orgIdDebounceRef.current);
        };
    }, [orgIdValue]);

    // ── Password Login ─────────────────────────────────────────────────────────
    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            const response = await authService.login(data);

            // ── MFA required: backend returned 202 with a challenge token ─────
            if ("mfaRequired" in response && response.mfaRequired) {
                setMfaChallengeToken(response.mfaChallengeToken);
                return; // render the TOTP card
            }

            // ── Normal login success ──────────────────────────────────────────
            if ("token" in response && response.token) {
                localStorage.setItem("token", response.token);
                localStorage.setItem("user", JSON.stringify(response.user));
                api.defaults.headers.common["Authorization"] = `Bearer ${response.token}`;
                toast.success(`Welcome back, ${response.user.firstName}!`);
                router.push("/dashboard");
            } else {
                toast.error("Invalid response from server");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || error.response?.data?.message || "Failed to login. Please check your credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    // ── MFA Challenge Submit ───────────────────────────────────────────────────
    const onMfaSubmit = async () => {
        if (!mfaCode || mfaCode.length !== 6) {
            toast.error("Enter the 6-digit code from your authenticator app.");
            return;
        }
        if (!mfaChallengeToken) return;
        setIsMfaSubmitting(true);
        try {
            const res = await mfaService.challenge({ mfaChallengeToken, code: mfaCode });
            if (res.token) {
                localStorage.setItem("token", res.token);
                localStorage.setItem("user", JSON.stringify(res.user));
                api.defaults.headers.common["Authorization"] = `Bearer ${res.token}`;
                toast.success(`Welcome back, ${res.user.firstName}!`);
                router.push("/dashboard");
            }
        } catch (error: any) {
            const msg = error.response?.data?.error || "Invalid authenticator code.";
            toast.error(msg);
            setMfaCode("");
        } finally {
            setIsMfaSubmitting(false);
        }
    };

    // ── SSO Login ──────────────────────────────────────────────────────────────
    const handleSsoLogin = async (provider: string) => {
        const orgId = String(orgIdValue ?? "").trim();
        if (!orgId) {
            toast.error("Please enter your Organization ID to continue with SSO");
            return;
        }
        try {
            setSsoProvider(provider);
            const redirectUri = `${window.location.origin}/login/sso-callback`;
            const url = provider === "SAML"
                ? await ssoAuthService.getSamlRedirectUrl({ organisationId: orgId, provider })
                : await ssoAuthService.getOAuth2AuthorizeUrl({ organisationId: orgId, provider, redirectUri });
            window.location.href = url;
        } catch (error: any) {
            toast.error(error.response?.data?.message || `Failed to initiate ${provider} SSO`);
        } finally {
            setSsoProvider("");
        }
    };

    // ── MFA Step ───────────────────────────────────────────────────────────────
    if (mfaChallengeToken) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
                <Card className="w-full max-w-sm shadow-xl border-t-4 border-t-indigo-600">
                    <CardHeader className="space-y-2 text-center">
                        <div className="mx-auto bg-indigo-100 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                            <Smartphone className="w-6 h-6 text-indigo-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
                        <CardDescription>
                            Open your authenticator app and enter the 6-digit code for <strong>AssetManager</strong>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="mfaCode">Authenticator Code</Label>
                            <Input
                                id="mfaCode"
                                placeholder="000000"
                                maxLength={6}
                                value={mfaCode}
                                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ""))}
                                className="text-center text-2xl tracking-[0.5em] font-mono"
                                autoFocus
                                onKeyDown={e => e.key === "Enter" && onMfaSubmit()}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3">
                        <Button
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={onMfaSubmit}
                            disabled={isMfaSubmitting || mfaCode.length !== 6}
                        >
                            {isMfaSubmitting ? "Verifying..." : "Verify & Sign In"}
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => { setMfaChallengeToken(null); setMfaCode(""); }}
                        >
                            Back to Login
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    // ── SSO button visibility ──────────────────────────────────────────────────
    const showSsoSection = activeSso?.enabled === true && activeSso.provider;
    const ssoProvider_ = activeSso?.provider ?? "";

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
            <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-emerald-600">
                <CardHeader className="space-y-2 text-center">
                    <div className="mx-auto bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight">Welcome Back</CardTitle>
                    <CardDescription>
                        Sign in to your Enterprise Asset Management account
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@company.com"
                                {...register("email", { required: "Email is required" })}
                                className={errors.email ? "border-red-500" : ""}
                            />
                            {errors.email && (
                                <p className="text-sm text-red-500">{errors.email.message as string}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <Link href="/forgot-password" className="text-sm font-medium text-emerald-600 hover:underline">
                                    Forgot password?
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                {...register("password", { required: "Password is required" })}
                                className={errors.password ? "border-red-500" : ""}
                            />
                            {errors.password && (
                                <p className="text-sm text-red-500">{errors.password.message as string}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="organisationId" className="text-slate-600">
                                Organization ID{" "}
                                <span className="text-slate-400 font-normal">
                                    (optional — only if your email exists in multiple orgs)
                                </span>
                            </Label>
                            <Input
                                id="organisationId"
                                placeholder="e.g. 18571af6-3a7e-4a9e-a85f-754fccb96715"
                                {...register("organisationId")}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        <Button
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={isLoading}
                        >
                            {isLoading ? "Signing in..." : "Sign in"}
                        </Button>

                        {/* SSO section — only visible when org has an active SSO provider */}
                        {ssoLoading && (
                            <p className="text-xs text-center text-slate-400 animate-pulse">
                                Checking SSO configuration…
                            </p>
                        )}

                        {showSsoSection && (
                            <>
                                <div className="relative w-full py-2">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-slate-200" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-white px-2 text-slate-500">Or continue with SSO</span>
                                    </div>
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full border-slate-200 hover:bg-slate-50"
                                    disabled={Boolean(ssoProvider)}
                                    onClick={() => handleSsoLogin(ssoProvider_)}
                                >
                                    {SSO_PROVIDER_LABELS[ssoProvider_]?.icon}
                                    {ssoProvider === ssoProvider_
                                        ? "Starting SSO…"
                                        : `Continue with ${SSO_PROVIDER_LABELS[ssoProvider_]?.label ?? ssoProvider_}`}
                                </Button>
                            </>
                        )}

                        <div className="text-sm text-center text-gray-500 pt-4 border-t space-y-2">
                            <div>
                                Learn more about the platform{" "}
                                <Link href="/" className="font-semibold text-emerald-600 hover:underline">
                                    View product overview
                                </Link>
                            </div>
                            <div>
                                Need to create a new workspace?{" "}
                                <Link href="/register-tenant" className="font-semibold text-emerald-600 hover:underline">
                                    Register Organization
                                </Link>
                            </div>
                            <div>
                                Joining an existing workspace?{" "}
                                <Link href="/register" className="font-semibold text-emerald-600 hover:underline">
                                    Create User Account
                                </Link>
                            </div>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
