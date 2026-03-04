"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { authService } from "@/services/authService";

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [isLoading, setIsLoading] = useState(false);
    const { register, handleSubmit, formState: { errors } } = useForm();

    const onSubmit = async (data: any) => {
        if (!token) {
            toast.error("Missing reset token");
            return;
        }

        setIsLoading(true);
        try {
            const response = await authService.resetPassword({
                token,
                newPassword: data.newPassword
            });
            toast.success(response.message || "Password has been successfully reset");
            router.push("/login"); // redirect to login upon success
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to reset password. Token may be invalid or expired.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="text-center py-6">
                <p className="text-red-500 mb-4">Invalid or missing reset token.</p>
                <Link href="/forgot-password" className="font-semibold text-emerald-600 hover:underline">
                    Request a new reset link
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                        id="newPassword"
                        type="password"
                        placeholder="••••••••"
                        {...register("newPassword", {
                            required: "New boundary password is required",
                            minLength: {
                                value: 8,
                                message: "Password must be at least 8 characters long"
                            }
                        })}
                        className={errors.newPassword ? "border-red-500" : ""}
                    />
                    {errors.newPassword && (
                        <p className="text-sm text-red-500">{errors.newPassword.message as string}</p>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
                    {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
                <div className="text-sm text-center text-gray-500 pt-4 border-t w-full">
                    Remember your password?{" "}
                    <Link href="/login" className="font-semibold text-emerald-600 hover:underline">
                        Sign in
                    </Link>
                </div>
            </CardFooter>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
            <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-emerald-600">
                <CardHeader className="space-y-2 text-center">
                    <div className="mx-auto bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight">Reset Password</CardTitle>
                    <CardDescription>
                        Enter your new secure password
                    </CardDescription>
                </CardHeader>
                <Suspense fallback={<div className="text-center py-6">Loading...</div>}>
                    <ResetPasswordForm />
                </Suspense>
            </Card>
        </div>
    );
}
