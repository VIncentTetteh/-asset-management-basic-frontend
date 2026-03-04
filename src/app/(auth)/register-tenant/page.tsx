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
import { authService, TenantRegistrationDto } from "@/services/authService";

export default function RegisterTenantPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const { register, handleSubmit, formState: { errors } } = useForm<TenantRegistrationDto>();

    const onSubmit = async (data: TenantRegistrationDto) => {
        setIsLoading(true);
        try {
            const response = await authService.registerTenant(data);
            // POST /tenant/register returns { organisationId, adminUserId, message }
            // — no JWT. The admin must log in separately.
            toast.success(response.message || "Workspace created successfully! Please log in.");
            router.push("/login");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Registration failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4 py-8">
            <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-emerald-600">
                <CardHeader className="space-y-2 text-center">
                    <CardTitle className="text-3xl font-bold tracking-tight">Create a New Workspace</CardTitle>
                    <CardDescription>
                        Set up your Enterprise Asset Management organization
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="organisationName">Organization Name</Label>
                                    <Input
                                        id="organisationName"
                                        placeholder="Acme Corp"
                                        {...register("organisationName", { required: "Organization name is required" })}
                                        className={errors.organisationName ? "border-red-500" : ""}
                                    />
                                    {errors.organisationName && (
                                        <p className="text-sm text-red-500">{errors.organisationName.message as string}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="organisationContactEmail">Contact Email</Label>
                                    <Input
                                        id="organisationContactEmail"
                                        placeholder="admin@acme.com"
                                        {...register("organisationContactEmail")}
                                        className={errors.organisationContactEmail ? "border-red-500" : ""}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="country">Country</Label>
                                    <Input
                                        id="country"
                                        placeholder="USA"
                                        {...register("country")}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="timezone">Timezone</Label>
                                    <Input
                                        id="timezone"
                                        placeholder="UTC"
                                        {...register("timezone")}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                <div className="space-y-2">
                                    <Label htmlFor="adminFirstName">Admin First Name</Label>
                                    <Input
                                        id="adminFirstName"
                                        placeholder="Alice"
                                        {...register("adminFirstName", { required: "First name is required" })}
                                        className={errors.adminFirstName ? "border-red-500" : ""}
                                    />
                                    {errors.adminFirstName && (
                                        <p className="text-sm text-red-500">{errors.adminFirstName.message as string}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="adminLastName">Admin Last Name</Label>
                                    <Input
                                        id="adminLastName"
                                        placeholder="Smith"
                                        {...register("adminLastName", { required: "Last name is required" })}
                                        className={errors.adminLastName ? "border-red-500" : ""}
                                    />
                                    {errors.adminLastName && (
                                        <p className="text-sm text-red-500">{errors.adminLastName.message as string}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="adminEmail">Admin Work Email</Label>
                                <Input
                                    id="adminEmail"
                                    type="email"
                                    placeholder="alice@acme.com"
                                    {...register("adminEmail", {
                                        required: "Email is required",
                                        pattern: { value: /\S+@\S+\.\S+/, message: "Invalid email address" }
                                    })}
                                    className={errors.adminEmail ? "border-red-500" : ""}
                                />
                                {errors.adminEmail && (
                                    <p className="text-sm text-red-500">{errors.adminEmail.message as string}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Min 8 characters"
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
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-4 pt-4">
                        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
                            {isLoading ? "Provisioning Workspace..." : "Create Organization & Admin"}
                        </Button>
                        <div className="text-sm text-center text-gray-500 space-y-2">
                            <div>
                                Joining an existing organization?{" "}
                                <Link href="/register" className="font-semibold text-emerald-600 hover:underline">
                                    Register Here
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
