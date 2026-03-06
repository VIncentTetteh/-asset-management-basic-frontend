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

export default function RegisterPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const { register, handleSubmit, formState: { errors }, watch } = useForm();
    const password = watch("password");

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            await authService.register({
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                password: data.password,
                jobTitle: data.jobTitle,
                organisationId: data.organisationId, // User must provide this based on the API
            });

            toast.success("Registration successful! Please sign in.");
            router.push("/login");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Registration failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4 py-8">
            <Card className="w-full max-w-2xl shadow-xl border-t-4 border-t-emerald-600">
                <CardHeader className="space-y-2 text-center">
                    <CardTitle className="text-3xl font-bold tracking-tight">Create an Account</CardTitle>
                    <CardDescription>
                        Register for the Enterprise Asset Management platform
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                    id="firstName"
                                    placeholder="John"
                                    {...register("firstName", { required: "First name is required" })}
                                    className={errors.firstName ? "border-red-500" : ""}
                                />
                                {errors.firstName && (
                                    <p className="text-sm text-red-500">{errors.firstName.message as string}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                    id="lastName"
                                    placeholder="Doe"
                                    {...register("lastName", { required: "Last name is required" })}
                                    className={errors.lastName ? "border-red-500" : ""}
                                />
                                {errors.lastName && (
                                    <p className="text-sm text-red-500">{errors.lastName.message as string}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="jobTitle">Job Title</Label>
                                <Input
                                    id="jobTitle"
                                    placeholder="Manager"
                                    {...register("jobTitle")}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="organisationId">Organization ID</Label>
                                <Input
                                    id="organisationId"
                                    placeholder="Enter your organization UUID"
                                    {...register("organisationId", { required: "Organization ID is required" })}
                                    className={errors.organisationId ? "border-red-500" : ""}
                                />
                                {errors.organisationId && (
                                    <p className="text-sm text-red-500">{errors.organisationId.message as string}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Work Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="john.doe@company.com"
                                    {...register("email", {
                                        required: "Email is required",
                                        pattern: { value: /\S+@\S+\.\S+/, message: "Invalid email address" }
                                    })}
                                    className={errors.email ? "border-red-500" : ""}
                                />
                                {errors.email && (
                                    <p className="text-sm text-red-500">{errors.email.message as string}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="+1 (555) 000-0000"
                                    {...register("phone")}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    {...register("password", {
                                        required: "Password is required",
                                        minLength: { value: 8, message: "Must be at least 8 characters" }
                                    })}
                                    className={errors.password ? "border-red-500" : ""}
                                />
                                {errors.password && (
                                    <p className="text-sm text-red-500">{errors.password.message as string}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    {...register("confirmPassword", {
                                        required: "Please confirm your password",
                                        validate: value => value === password || "Passwords do not match"
                                    })}
                                    className={errors.confirmPassword ? "border-red-500" : ""}
                                />
                                {errors.confirmPassword && (
                                    <p className="text-sm text-red-500">{errors.confirmPassword.message as string}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 pt-4">
                        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
                            {isLoading ? "Registering..." : "Create Account"}
                        </Button>
                        <div className="text-sm text-center text-gray-500 space-y-2">
                            <div>
                                Learn more about the platform{" "}
                                <Link href="/" className="font-semibold text-emerald-600 hover:underline">
                                    View product overview
                                </Link>
                            </div>
                            <div>
                                Setting up a new company?{" "}
                                <Link href="/register-tenant" className="font-semibold text-emerald-600 hover:underline">
                                    Create a Workspace
                                </Link>
                            </div>
                            <div>
                                Already have an account?{" "}
                                <Link href="/login" className="font-semibold text-emerald-600 hover:underline">
                                    Sign in
                                </Link>
                            </div>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
