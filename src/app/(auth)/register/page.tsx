"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserX, Mail } from "lucide-react";

export default function RegisterPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-md shadow-sm">
                <CardHeader className="text-center pb-4">
                    <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserX className="h-7 w-7 text-slate-400" />
                    </div>
                    <CardTitle className="text-xl text-slate-900">Self-Registration Unavailable</CardTitle>
                    <CardDescription className="text-slate-500 mt-1">
                        User accounts are created by your organisation administrator. Please contact your admin to get access.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pb-6">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
                        <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <span>Ask your organisation admin to invite you from the Users management panel. You will receive a welcome email with login details.</span>
                    </div>
                    <Button asChild className="w-full bg-zinc-800 hover:bg-zinc-900 mt-2">
                        <Link href="/login">Back to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
