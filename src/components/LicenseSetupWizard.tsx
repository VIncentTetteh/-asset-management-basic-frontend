"use client";

/**
 * LicenseSetupWizard — Phase 3 (standalone only)
 *
 * A blocking multi-step overlay shown when the app is running in standalone
 * mode and no license key has been activated yet (status has no `active` or
 * `plan` field).
 *
 * Steps:
 *   1. Welcome + paste license key
 *   2. Confirm organisation details
 *   3. Ready — close wizard and enter the app
 *
 * In cloud mode this component renders null and adds zero overhead.
 */

import React, { useState, useRef } from "react";
import {
    CheckCircle,
    Key,
    Building2,
    Rocket,
    ArrowRight,
    Loader2,
    AlertCircle,
    Copy,
    Check,
    ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLicenseStatus } from "@/contexts/LicenseContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface StepInfo {
    number: Step;
    label: string;
    icon: React.ReactNode;
}

const STEPS: StepInfo[] = [
    { number: 1, label: "Activate License",  icon: <Key      className="h-4 w-4" /> },
    { number: 2, label: "Verify Setup",      icon: <Building2 className="h-4 w-4" /> },
    { number: 3, label: "Ready",             icon: <Rocket   className="h-4 w-4" /> },
];

// ── Helper: call the backend activate endpoint ─────────────────────────────────

async function activateLicenseKey(key: string): Promise<void> {
    const res = await fetch("/api/v1/license/activate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ licenseKey: key }),
        credentials: "include",
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Activation failed (HTTP ${res.status})`);
    }
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
    return (
        <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((step, idx) => {
                const isDone    = step.number < current;
                const isActive  = step.number === current;
                return (
                    <React.Fragment key={step.number}>
                        <div className="flex flex-col items-center gap-1">
                            <div
                                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                                    isDone
                                        ? "border-teal-600 bg-teal-600 text-white"
                                        : isActive
                                        ? "border-teal-600 bg-white text-teal-600"
                                        : "border-slate-200 bg-white text-slate-400"
                                }`}
                            >
                                {isDone ? <Check className="h-4 w-4" /> : step.icon}
                            </div>
                            <span
                                className={`text-xs font-medium whitespace-nowrap ${
                                    isActive ? "text-teal-700" : isDone ? "text-teal-600" : "text-slate-400"
                                }`}
                            >
                                {step.label}
                            </span>
                        </div>
                        {idx < STEPS.length - 1 && (
                            <div
                                className={`h-0.5 w-10 flex-1 mt-[-1rem] transition-colors ${
                                    step.number < current ? "bg-teal-500" : "bg-slate-200"
                                }`}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ── Step 1: Enter license key ─────────────────────────────────────────────────

function Step1({
    onSuccess,
}: {
    onSuccess: (plan: string) => void;
}) {
    const [key, setKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { refresh } = useLicenseStatus();

    const handleActivate = async () => {
        const trimmed = key.trim();
        if (!trimmed) { setError("Please enter your license key."); return; }
        setError(null);
        setLoading(true);
        try {
            await activateLicenseKey(trimmed);
            // Re-fetch license status so the context is up to date before step 2
            await refresh();
            onSuccess("professional"); // plan name will be read from refreshed context in step 2
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Activation failed. Check your key and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
                    <Key className="h-8 w-8 text-teal-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Activate your license</h2>
                <p className="mt-2 text-sm text-slate-500">
                    Enter the license key you received after purchasing your AssetIQ Standalone plan.
                    <br />
                    Don&apos;t have one yet?{" "}
                    <a
                        href="https://portal.assetiq.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-teal-600 underline underline-offset-2 hover:text-teal-700"
                    >
                        Purchase a plan <ExternalLink className="h-3 w-3" />
                    </a>
                </p>
            </div>

            <div className="space-y-2">
                <label htmlFor="license-key-input" className="block text-sm font-medium text-slate-700">
                    License key
                </label>
                <textarea
                    id="license-key-input"
                    rows={5}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-700 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="eyJhbGciOiJSUzI1NiJ9.eyJwbGFuIjoicHJvZmVzc2lvbmFsIiwi..."
                    value={key}
                    onChange={(e) => { setKey(e.target.value); setError(null); }}
                    disabled={loading}
                    spellCheck={false}
                    autoComplete="off"
                />
                {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                        <p className="text-xs text-red-700">{error}</p>
                    </div>
                )}
            </div>

            <Button
                onClick={handleActivate}
                disabled={loading || !key.trim()}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Activating…
                    </>
                ) : (
                    <>
                        Activate license
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                )}
            </Button>

            <p className="text-center text-xs text-slate-400">
                The key is verified locally — your data never leaves your server.
            </p>
        </div>
    );
}

// ── Step 2: Verify setup ──────────────────────────────────────────────────────

function Step2({ onNext }: { onNext: () => void }) {
    const { status } = useLicenseStatus();

    const limits   = status.limits;
    const features = status.features;
    const plan     = status.plan ?? "—";
    const expires  = status.expiresAt
        ? new Date(status.expiresAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
        : "—";

    const limitRows = [
        { label: "Assets",      value: limits?.assets      === -1 ? "Unlimited" : (limits?.assets      ?? "—") },
        { label: "Users",       value: limits?.users        === -1 ? "Unlimited" : (limits?.users        ?? "—") },
        { label: "Departments", value: limits?.departments  === -1 ? "Unlimited" : (limits?.departments  ?? "—") },
    ];

    const featureRows = [
        { label: "API Access",     enabled: features?.apiAccess    !== false },
        { label: "Custom Fields",  enabled: features?.customFields !== false },
        { label: "SSO",            enabled: features?.sso          !== false },
        { label: "Advanced Analytics", enabled: features?.analytics === "full" },
    ];

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
                    <Building2 className="h-8 w-8 text-teal-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">License activated!</h2>
                <p className="mt-2 text-sm text-slate-500">
                    Your license key has been verified and applied. Here&apos;s a summary of your plan.
                </p>
            </div>

            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">Plan</span>
                    <span className="rounded-full bg-teal-600 px-3 py-0.5 text-xs font-bold uppercase text-white">
                        {plan}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Expires</span>
                    <span className="text-xs font-semibold text-slate-800">{expires}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Days remaining</span>
                    <span className="text-xs font-semibold text-slate-800">{status.daysRemaining ?? "—"}</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {limitRows.map(r => (
                    <div key={r.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
                        <p className="text-lg font-bold text-slate-900">{String(r.value)}</p>
                        <p className="text-xs text-slate-500">{r.label}</p>
                    </div>
                ))}
            </div>

            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Features</p>
                <div className="grid grid-cols-2 gap-1.5">
                    {featureRows.map(f => (
                        <div key={f.label} className="flex items-center gap-2">
                            <CheckCircle
                                className={`h-4 w-4 flex-shrink-0 ${f.enabled ? "text-teal-500" : "text-slate-300"}`}
                            />
                            <span className={`text-xs ${f.enabled ? "text-slate-700" : "text-slate-400 line-through"}`}>
                                {f.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <Button
                onClick={onNext}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
                Continue to workspace
                <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
    );
}

// ── Step 3: Ready ─────────────────────────────────────────────────────────────

function Step3({ onFinish }: { onFinish: () => void }) {
    const [copied, setCopied] = useState(false);
    const docsUrl = "https://docs.assetiq.io/standalone/getting-started";

    const handleCopy = () => {
        navigator.clipboard.writeText(docsUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="space-y-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <Rocket className="h-8 w-8 text-emerald-600" />
            </div>

            <div>
                <h2 className="text-xl font-bold text-slate-900">You&apos;re all set! 🎉</h2>
                <p className="mt-2 text-sm text-slate-500">
                    AssetIQ Standalone is ready. Your data stays on your servers,
                    under your control — always.
                </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-left">
                <p className="text-xs font-semibold text-slate-600">Quick tips to get started</p>
                {[
                    "Head to Assets → create your first asset or import a CSV.",
                    "Go to Settings → License any time to check key status or enter a renewal key.",
                    "Add users in the Users section and assign roles to control access.",
                    "Enable SSO under Settings → SSO Configuration (Enterprise plan).",
                ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-[10px] font-bold text-teal-700">
                            {i + 1}
                        </span>
                        <p className="text-xs text-slate-600">{tip}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-slate-500 font-mono">{docsUrl}</span>
                <button
                    onClick={handleCopy}
                    className="flex-shrink-0 rounded-md p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Copy docs URL"
                >
                    {copied ? <Check className="h-3.5 w-3.5 text-teal-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
            </div>

            <Button
                onClick={onFinish}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                size="lg"
            >
                Enter workspace
                <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
    );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function LicenseSetupWizard() {
    const { status } = useLicenseStatus();
    const [step, setStep] = useState<Step>(1);
    const [dismissed, setDismissed] = useState(false);

    // Only render in standalone mode when there is no active license
    const needsSetup =
        status.mode === "standalone" &&
        !status.active &&
        !status.plan;

    if (!needsSetup || dismissed) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-label="License setup wizard"
        >
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                            <Key className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">AssetIQ Standalone</p>
                            <p className="text-xs text-teal-100">License setup required</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-6">
                    <StepIndicator current={step} />

                    {step === 1 && (
                        <Step1 onSuccess={() => setStep(2)} />
                    )}
                    {step === 2 && (
                        <Step2 onNext={() => setStep(3)} />
                    )}
                    {step === 3 && (
                        <Step3 onFinish={() => setDismissed(true)} />
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Step {step} of 3</span>
                    {step === 1 && (
                        <a
                            href="mailto:support@assetiq.io"
                            className="text-xs text-teal-600 hover:underline"
                        >
                            Need help? Contact support
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
