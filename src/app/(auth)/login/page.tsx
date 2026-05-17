"use client";

import { useState } from "react";
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
import { orgSsoService } from "@/services/orgSsoService";
import { ssoAuthService } from "@/services/ssoAuthService";
import { clearVerifiedOrganisationId, setStoredUser } from "@/lib/authContext";
import { Eye, EyeOff, Smartphone } from "lucide-react";

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // SSO discovery state
    const [ssoDiscovery, setSsoDiscovery] = useState<{
        organisationId: string;
        provider: string;
    } | null>(null);
    const [ssoDiscovering, setSsoDiscovering] = useState(false);
    const [ssoLoading, setSsoLoading] = useState(false);

    // MFA challenge state
    const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
    const [mfaCode, setMfaCode] = useState("");
    const [isMfaSubmitting, setIsMfaSubmitting] = useState(false);

    const { register, handleSubmit, getValues, formState: { errors } } = useForm();

    // ── SSO Discovery ─────────────────────────────────────────────────────────
    const onEmailBlur = async () => {
        const email = (getValues("email") ?? "").trim();
        if (!email || !email.includes("@")) return;
        setSsoDiscovering(true);
        try {
            const result = await orgSsoService.discoverByEmail(email);
            if (result.ssoEnabled && result.organisationId && result.provider) {
                setSsoDiscovery({ organisationId: result.organisationId, provider: result.provider });
            } else {
                setSsoDiscovery(null);
            }
        } finally {
            setSsoDiscovering(false);
        }
    };

    const startSso = async () => {
        if (!ssoDiscovery) return;
        setSsoLoading(true);
        try {
            const redirectUri = `${window.location.origin}/login/sso-callback`;
            const authorizationUrl = await ssoAuthService.getOAuth2AuthorizeUrl({
                organisationId: ssoDiscovery.organisationId,
                redirectUri,
            });
            window.location.href = authorizationUrl;
        } catch {
            toast.error("Failed to start SSO. Please try again.");
            setSsoLoading(false);
        }
    };

    const providerLabel = ssoDiscovery?.provider.replace(/_/g, " ") ?? "";

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
                clearVerifiedOrganisationId();
                setStoredUser(response.user);
                window.dispatchEvent(new Event("auth-changed"));
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
                clearVerifiedOrganisationId();
                setStoredUser(res.user);
                window.dispatchEvent(new Event("auth-changed"));
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
                        {/* Email field */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@company.com"
                                {...register("email", {
                                    required: "Email is required",
                                    pattern: { value: /\S+@\S+\.\S+/, message: "Invalid email address" },
                                    onChange: () => setSsoDiscovery(null),
                                    onBlur: onEmailBlur,
                                })}
                                className={errors.email ? "border-red-500" : ""}
                            />
                            {errors.email && (
                                <p className="text-sm text-red-500">{errors.email.message as string}</p>
                            )}
                        </div>

                        {/* SSO discovery feedback */}
                        {ssoDiscovering && (
                            <p className="text-xs text-center text-slate-400">Checking your organisation…</p>
                        )}

                        {/* SSO discovery banner */}
                        {ssoDiscovery && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-col gap-3">
                                <p className="text-sm font-medium text-emerald-800 text-center">
                                    Your organisation uses {providerLabel} SSO
                                </p>
                                <Button
                                    type="button"
                                    onClick={startSso}
                                    disabled={ssoLoading}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {ssoLoading ? "Redirecting…" : `Continue with ${providerLabel}`}
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setSsoDiscovery(null)}
                                    className="text-xs text-slate-400 hover:text-slate-600 text-center"
                                >
                                    Or, use password instead
                                </button>
                            </div>
                        )}

                        {/* Password section — hidden when SSO detected */}
                        {!ssoDiscovery && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <Link href="/forgot-password" className="text-sm font-medium text-emerald-600 hover:underline">
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        {...register("password", { required: "Password is required" })}
                                        className={`pr-10 ${errors.password ? "border-red-500" : ""}`}
                                    />
                                    <button
                                        type="button"
                                        aria-label={showPassword ? "Mask password" : "Show password"}
                                        onClick={() => setShowPassword((value) => !value)}
                                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-800"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-sm text-red-500">{errors.password.message as string}</p>
                                )}
                            </div>
                        )}
                    </CardContent>

                    {!ssoDiscovery && (
                        <CardFooter className="flex flex-col space-y-4">
                            <Button
                                type="submit"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={isLoading}
                            >
                                {isLoading ? "Signing in..." : "Sign in"}
                            </Button>

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
                            </div>
                        </CardFooter>
                    )}
                </form>
            </Card>
        </div>
    );
}
