"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Mail } from "lucide-react";

/**
 * There is no self-registration into an existing organisation, and this page
 * exists to say so accurately.
 *
 * It used to promise "you will receive a welcome email with login details",
 * which was untrue on two counts: nothing was emailed, and an administrator who
 * created an account had to pass a temporary password on by hand. Invitations
 * changed the first half — an invited colleague now really does get an email —
 * and they never had login *details* to receive, because they choose their own
 * password. The copy now describes that, and nothing else.
 */
export default function RegisterPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-3 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
                        <Mail className="h-7 w-7 text-brand" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-xl">Joining a team? You need an invitation</CardTitle>
                    <CardDescription>
                        AssetIQ accounts are created by invitation, so that whoever runs your workspace decides what each
                        person can do before they arrive.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-card border border-edge bg-surface-muted p-4 text-sm text-muted-fg">
                        <p className="font-semibold text-foreground">What to expect</p>
                        <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                            <li>Ask an administrator at your organisation to invite you.</li>
                            <li>
                                You get an email with a link. Opening it shows you which company invited you and what your
                                role will let you do.
                            </li>
                            <li>
                                You choose your own password there — nobody emails you one — and then sign in straight away.
                            </li>
                        </ol>
                        <p className="mt-3 text-[13px]">
                            Invitation links expire. If yours has, ask for a new one rather than a password.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Button asChild variant="outline" className="w-full">
                            <Link href="/login">Back to sign in</Link>
                        </Button>
                        <Button asChild className="w-full">
                            <Link href="/register-tenant">
                                <Building2 className="mr-2 h-4 w-4" aria-hidden="true" /> Set up a new workspace instead
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
