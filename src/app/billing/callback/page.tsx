"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { billingService } from "@/services/billingService";
import { Subscription } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { extractErrorMessage } from "@/lib/error";
import { billingQueryKeys } from "@/features/billing/lib";

type VerifyState = "loading" | "success" | "error";

function VerifyingSpinner() {
    return (
        <div className="space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-faint-fg" />
            <p className="text-muted-fg">Verifying your payment with Paystack...</p>
        </div>
    );
}

/**
 * useSearchParams() needs a Suspense boundary in a static export: without one
 * the whole route bails out of prerendering.
 */
export default function BillingCallbackPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[70vh] items-center justify-center p-6">
                    <VerifyingSpinner />
                </div>
            }
        >
            <BillingCallbackContent />
        </Suspense>
    );
}

function BillingCallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [state, setState] = useState<VerifyState>("loading");
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [errorMessage, setErrorMessage] = useState("Verification failed.");
    // StrictMode mounts effects twice in development; a payment reference must
    // be verified exactly once per page load.
    const verifiedReference = useRef<string | null>(null);
    const reference = searchParams.get("reference") ?? searchParams.get("trxref");

    useEffect(() => {
        if (!reference || verifiedReference.current === reference) return;
        verifiedReference.current = reference;

        const verify = async () => {
            try {
                const sub = await billingService.verifyCheckout(reference);
                setSubscription(sub);
                setState("success");
                queryClient.setQueryData(billingQueryKeys.subscription, sub);
                void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
            } catch (error) {
                setState("error");
                setErrorMessage(extractErrorMessage(error, "Failed to verify checkout"));
            }
        };
        void verify();
    }, [reference, queryClient]);

    const view: VerifyState = reference ? state : "error";
    const message = reference ? errorMessage : "Missing payment reference in callback URL.";

    return (
        <div className="flex min-h-[70vh] items-center justify-center p-6">
            <Card className="w-full max-w-xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Billing Verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    {view === "loading" && <VerifyingSpinner />}

                    {view === "success" && subscription && (
                        <div className="space-y-3">
                            <CheckCircle2 className="mx-auto h-10 w-10 text-ok" />
                            <p className="font-semibold text-foreground">Subscription updated successfully</p>
                            <p className="text-sm text-muted-fg">
                                Plan: {subscription.plan.name} ({subscription.plan.code})
                            </p>
                            <p className="text-sm text-muted-fg">Status: {subscription.status}</p>
                            <Button onClick={() => router.push("/billing")}>Go to Billing</Button>
                        </div>
                    )}

                    {view === "error" && (
                        <div className="space-y-3">
                            <XCircle className="mx-auto h-10 w-10 text-danger" />
                            <p className="font-semibold text-foreground">Payment verification failed</p>
                            <p className="text-sm text-muted-fg">{message}</p>
                            <div className="flex justify-center gap-2">
                                <Button variant="outline" onClick={() => router.push("/billing")}>Back to Billing</Button>
                                <Button onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
