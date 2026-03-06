"use client";

import { useState, useEffect } from "react";
import { User, UserDto } from "@/types";
import { userService } from "@/services/userService";
import { organisationService } from "@/services/organisationService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { UserCircle, Mail, Phone, Building, Briefcase, Shield, Save } from "lucide-react";

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [organisatonName, setOrganisationName] = useState<string>("Loading...");

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserDto>();

    useEffect(() => {
        // Fetch current user from local storage
        const loadUserAndOrg = async () => {
            try {
                const storedUserStr = localStorage.getItem("user");
                if (storedUserStr) {
                    const storedUser = JSON.parse(storedUserStr) as User;
                    setUser(storedUser);

                    // Initialize form with user data
                    reset({
                        firstName: storedUser.firstName,
                        lastName: storedUser.lastName,
                        email: storedUser.email,
                        phone: storedUser.phone || "",
                        jobTitle: storedUser.jobTitle || "",
                    });

                    // Fetch Organisation name
                    if (storedUser.organisationId) {
                        try {
                            const org = await organisationService.get(storedUser.organisationId);
                            setOrganisationName(org.name);
                        } catch (e) {
                            console.error("Failed to fetch organisation name:", e);
                            setOrganisationName("Unknown Organisation");
                        }
                    } else {
                        setOrganisationName("No Organisation Assigned");
                    }
                } else {
                    toast.error("User session not found. Please log in again.");
                }
            } catch (error) {
                console.error("Error parsing user data:", error);
                toast.error("Failed to load user profile");
            } finally {
                setIsLoading(false);
            }
        };

        loadUserAndOrg();
    }, [reset]);

    const onSubmit = async (data: UserDto) => {
        if (!user || (!user.id && !('id' in user))) {
            toast.error("Cannot update profile: User ID missing");
            return;
        }

        try {
            // Clean up empty optional fields
            if (!data.phone) delete data.phone;
            if (!data.jobTitle) delete data.jobTitle;

            // Preserve existing relationships that shouldn't be changed via this restricted form
            const updatePayload: UserDto = {
                ...data,
                organisationId: user.organisationId,
                departmentId: user.departmentId,
                roleId: user.roleId,
                status: user.status
            };

            const updatedUser = await userService.update(user.id!, updatePayload);

            // Update local storage so changes persist across refresh
            localStorage.setItem("user", JSON.stringify(updatedUser));
            setUser(updatedUser);

            toast.success("Profile updated successfully");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to update profile");
            console.error(error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <UserCircle className="h-16 w-16 text-slate-300" />
                <h2 className="text-xl font-semibold text-slate-700">Profile Not Found</h2>
                <p className="text-slate-500">Please ensure you are logged in correctly.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Profile</h1>
                    <p className="text-slate-500">Manage your personal information and account preferences.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Overview Card */}
                <Card className="md:col-span-1 h-fit shadow-sm border-slate-200">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto bg-gradient-to-tr from-indigo-500 to-purple-400 w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-md ring-4 ring-white mb-4">
                            {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <CardTitle className="text-xl">{user.firstName} {user.lastName}</CardTitle>
                        <CardDescription className="text-indigo-600 font-medium">{user.jobTitle || "Employee"}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                            <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                            <span className="truncate">{user.email}</span>
                        </div>
                        {user.phone && (
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                                <span>{user.phone}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                            <Building className="h-4 w-4 text-slate-400 shrink-0" />
                            <span>{organisatonName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                            <Briefcase className="h-4 w-4 text-slate-400 shrink-0" />
                            <span>Department ID: {user.departmentId || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-indigo-700 bg-indigo-50 p-2 rounded-md font-medium border border-indigo-100 mt-2">
                            <Shield className="h-4 w-4 text-indigo-500 shrink-0" />
                            <span>Role ID: {user.roleId || 'N/A'}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Edit Form Card */}
                <Card className="md:col-span-2 shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                        <CardDescription>Update your contact details and job title.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="firstName"
                                        {...register("firstName", { required: "First name is required" })}
                                        className={errors.firstName ? "border-red-500 ring-red-500" : ""}
                                    />
                                    {errors.firstName && <p className="text-sm text-red-500">{errors.firstName.message as string}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="lastName"
                                        {...register("lastName", { required: "Last name is required" })}
                                        className={errors.lastName ? "border-red-500 ring-red-500" : ""}
                                    />
                                    {errors.lastName && <p className="text-sm text-red-500">{errors.lastName.message as string}</p>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                                <Input
                                    id="email"
                                    type="email"
                                    {...register("email", {
                                        required: "Email is required",
                                        pattern: { value: /^\S+@\S+$/i, message: "Invalid email format" }
                                    })}
                                    className={errors.email ? "border-red-500 ring-red-500" : ""}
                                />
                                {errors.email && <p className="text-sm text-red-500">{errors.email.message as string}</p>}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="+1 (555) 000-0000"
                                        {...register("phone")}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="jobTitle">Job Title</Label>
                                    <Input
                                        id="jobTitle"
                                        placeholder="e.g. Software Engineer"
                                        {...register("jobTitle")}
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-600">
                                <h4 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                                    <Shield className="h-4 w-4" /> Security & Access
                                </h4>
                                <p>To modify your organisation, department, or role permissions, please contact your system administrator. These fields are locked for security purposes.</p>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-slate-100">
                                <Button type="submit" isLoading={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]">
                                    <Save className="h-4 w-4 mr-2" />
                                    {isSubmitting ? "Saving..." : "Save Changes"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
