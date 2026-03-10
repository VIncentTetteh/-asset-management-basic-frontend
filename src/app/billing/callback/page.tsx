"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { billingService } from "@/services/billingService";
import { Subscription } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type VerifyState = "loading" | "success" | "error";

export default function BillingCallbackPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [state, setState] = useState<VerifyState>("loading");
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [errorMessage, setErrorMessage] = useState("Verification failed.");

    useEffect(() => {
        const verify = async () => {
            const reference = searchParams.get("reference");
            if (!reference) {
                setState("error");
                setErrorMessage("Missing payment reference in callback URL.");
                return;
            }

            try {
                const sub = await billingService.verifyCheckout(reference);
                setSubscription(sub);
                setState("success");
            } catch (error: any) {
                setState("error");
                setErrorMessage(error?.response?.data?.message || "Failed to verify checkout");
            }
        };
        verify();
    }, [searchParams]);

    return (
        <div className="min-h-[70vh] flex items-center justify-center p-6">
            <Card className="w-full max-w-xl border-slate-200">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Billing Verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    {state === "loading" && (
                        <div className="space-y-3">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-500" />
                            <p className="text-slate-600">Verifying your payment with Paystack...</p>
                        </div>
                    )}

                    {state === "success" && subscription && (
                        <div className="space-y-3">
                            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600" />
                            <p className="font-semibold text-slate-900">Subscription updated successfully</p>
                            <p className="text-sm text-slate-600">Plan: {subscription.plan.name} ({subscription.plan.code})</p>
                            <p className="text-sm text-slate-600">Status: {subscription.status}</p>
                            <Button onClick={() => router.push("/billing")}>Go to Billing</Button>
                        </div>
                    )}

                    {state === "error" && (
                        <div className="space-y-3">
                            <XCircle className="h-10 w-10 mx-auto text-red-600" />
                            <p className="font-semibold text-slate-900">Payment verification failed</p>
                            <p className="text-sm text-slate-600">{errorMessage}</p>
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

