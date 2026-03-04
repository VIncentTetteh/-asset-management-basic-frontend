"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { authService } from "@/services/authService";

export default function ForgotPasswordPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const { register, handleSubmit, formState: { errors } } = useForm();

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            const response = await authService.forgotPassword(data);
            toast.success(response.message || "Password reset instructions sent to email");

            // Note: Since emails aren't sent right now, auto-redirect or allow testing token
            if (response.token) {
                console.log("Reset token for testing:", response.token);
                toast.success(`Testing Token: ${response.token}`);
            }
            setIsSubmitted(true);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to process request. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
            <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-emerald-600">
                <CardHeader className="space-y-2 text-center">
                    <div className="mx-auto bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight">Forgot Password</CardTitle>
                    <CardDescription>
                        Enter your email to receive password reset instructions
                    </CardDescription>
                </CardHeader>
                {!isSubmitted ? (
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
                        </CardContent>
                        <CardFooter className="flex flex-col space-y-4">
                            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
                                {isLoading ? "Sending..." : "Send Reset Link"}
                            </Button>
                            <div className="text-sm text-center text-gray-500 pt-4 border-t w-full">
                                Remember your password?{" "}
                                <Link href="/login" className="font-semibold text-emerald-600 hover:underline">
                                    Sign in
                                </Link>
                            </div>
                        </CardFooter>
                    </form>
                ) : (
                    <CardContent className="space-y-4 py-6">
                        <div className="text-center text-sm space-y-4">
                            <p>We've sent an email with instructions to reset your password.</p>
                            <p className="text-gray-500">If you don't see it, check your spam folder.</p>
                            <div className="pt-4 border-t mt-6">
                                <Link href="/login" className="font-semibold text-emerald-600 hover:underline">
                                    Return to login
                                </Link>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
