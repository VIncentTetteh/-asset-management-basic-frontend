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
import api from "@/lib/axios"; // Keep this if `api` is used elsewhere, otherwise remove. Assuming it's still needed for setting default headers.

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const { register, handleSubmit, formState: { errors } } = useForm();

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            const response = await authService.login(data);

            if (response.token) {
                localStorage.setItem("token", response.token);
                localStorage.setItem("user", JSON.stringify(response.user));

                api.defaults.headers.common["Authorization"] = `Bearer ${response.token}`;
                toast.success(`Welcome back, ${response.user.firstName}!`);
                router.push("/assets"); // redirect to main dashboard
            } else {
                toast.error("Invalid response from server");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to login. Please check your credentials.");
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
                                <Link href="#" className="text-sm font-medium text-emerald-600 hover:underline">
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
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
                            {isLoading ? "Signing in..." : "Sign in"}
                        </Button>
                        <div className="text-sm text-center text-gray-500">
                            Don't have an account?{" "}
                            <Link href="/register" className="font-semibold text-emerald-600 hover:underline">
                                Request Access
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
