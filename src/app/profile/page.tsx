"use client";

import { useState, useEffect } from "react";
import { User, UserDto, MfaSetupResponse } from "@/types";
import { userService } from "@/services/userService";
import { organisationService } from "@/services/organisationService";
import { mfaService } from "@/services/mfaService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { UserCircle, Mail, Phone, Building, Briefcase, Shield, Save, ShieldCheck, ShieldOff } from "lucide-react";
import { buildPatchPayload } from "@/lib/patch";

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [organisatonName, setOrganisationName] = useState<string>("Loading...");

    // MFA state
    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [mfaSetupData, setMfaSetupData] = useState<MfaSetupResponse | null>(null);
    const [mfaSetupStep, setMfaSetupStep] = useState<"idle" | "scan" | "verify">("idle");
    const [mfaCode, setMfaCode] = useState("");
    const [isMfaLoading, setIsMfaLoading] = useState(false);
    const [isDisableMfaModalOpen, setIsDisableMfaModalOpen] = useState(false);
    const [disableMfaCode, setDisableMfaCode] = useState("");

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserDto>();

    const handleStartMfaSetup = async () => {
        setIsMfaLoading(true);
        try {
            const data = await mfaService.setup();
            setMfaSetupData(data);
            setMfaSetupStep("scan");
            setMfaCode("");
        } catch {
            toast.error("Failed to start MFA setup");
        } finally {
            setIsMfaLoading(false);
        }
    };

    const handleVerifyMfa = async () => {
        if (!mfaCode) { toast.error("Enter the 6-digit code"); return; }
        setIsMfaLoading(true);
        try {
            await mfaService.verify({ code: mfaCode });
            toast.success("MFA enabled successfully");
            setMfaEnabled(true);
            setMfaSetupStep("idle");
            setMfaSetupData(null);
            setMfaCode("");
        } catch {
            toast.error("Invalid code. Please try again.");
        } finally {
            setIsMfaLoading(false);
        }
    };

    const handleDisableMfa = async () => {
        if (!disableMfaCode) { toast.error("Enter your current TOTP code"); return; }
        setIsMfaLoading(true);
        try {
            await mfaService.disable({ code: disableMfaCode });
            toast.success("MFA disabled");
            setMfaEnabled(false);
            setIsDisableMfaModalOpen(false);
            setDisableMfaCode("");
        } catch {
            toast.error("Invalid code. MFA not disabled.");
        } finally {
            setIsMfaLoading(false);
        }
    };

    useEffect(() => {
        const loadUserAndOrg = async () => {
            try {
                // Always fetch fresh profile from the API — localStorage never contains mfaEnabled
                const freshUser = await userService.getMe();
                setUser(freshUser);
                setMfaEnabled(Boolean(freshUser.mfaEnabled));

                // Initialize form with live data
                reset({
                    firstName: freshUser.firstName,
                    lastName: freshUser.lastName,
                    email: freshUser.email,
                    phone: freshUser.phone || "",
                    jobTitle: freshUser.jobTitle || "",
                });

                // Fetch Organisation name
                if (freshUser.organisationId) {
                    try {
                        const org = await organisationService.get(freshUser.organisationId);
                        setOrganisationName(org.name);
                    } catch (e) {
                        console.error("Failed to fetch organisation name:", e);
                        setOrganisationName("Unknown Organisation");
                    }
                } else {
                    setOrganisationName("No Organisation Assigned");
                }
            } catch (error) {
                console.error("Error loading profile:", error);
                toast.error("Failed to load user profile");
            } finally {
                setIsLoading(false);
            }
        };

        loadUserAndOrg();
    }, [reset]);

    const onSubmit = async (data: UserDto) => {
        try {
            // Build a patch payload containing only the fields this form can change
            const patchPayload = {
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone || undefined,
                jobTitle: data.jobTitle || undefined,
            };

            // Only send if something actually changed
            const patch = buildPatchPayload<typeof patchPayload>(
                { firstName: user?.firstName, lastName: user?.lastName, phone: user?.phone, jobTitle: user?.jobTitle },
                patchPayload
            );
            if (Object.keys(patch).length === 0) {
                toast("No changes to update");
                return;
            }

            // Use the self-service endpoint — no ROLE_ADMIN needed
            const updatedUser = await userService.patchMe(patchPayload);

            // Merge the updated fields into the locally cached user object
            const merged = { ...user, ...updatedUser } as User;
            localStorage.setItem("user", JSON.stringify(merged));
            setUser(merged);

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

            {/* MFA Card */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-indigo-500" />
                        Two-Factor Authentication
                    </CardTitle>
                    <CardDescription>
                        Add an extra layer of security using a TOTP authenticator app (e.g. Google Authenticator, Authy).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {mfaEnabled ? (
                        <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="h-6 w-6 text-emerald-600" />
                                <div>
                                    <p className="font-semibold text-emerald-800">MFA is enabled</p>
                                    <p className="text-sm text-emerald-600">Your account is protected with two-factor authentication.</p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => { setIsDisableMfaModalOpen(true); setDisableMfaCode(""); }}
                                className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                                <ShieldOff className="h-4 w-4 mr-2" />
                                Disable MFA
                            </Button>
                        </div>
                    ) : mfaSetupStep === "idle" ? (
                        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Shield className="h-6 w-6 text-slate-400" />
                                <div>
                                    <p className="font-semibold text-slate-700">MFA is not enabled</p>
                                    <p className="text-sm text-slate-500">Enable MFA to secure your account with a TOTP code.</p>
                                </div>
                            </div>
                            <Button
                                onClick={handleStartMfaSetup}
                                isLoading={isMfaLoading}
                                className="bg-indigo-600 hover:bg-indigo-700"
                            >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Enable MFA
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                                Scan the QR code below with your authenticator app, then enter the 6-digit code to confirm.
                            </div>
                            {mfaSetupData && (
                                <div className="flex flex-col items-center gap-4">
                                    <img
                                        src={mfaSetupData.qrCodeImage}
                                        alt="MFA QR Code"
                                        className="w-48 h-48 border border-slate-200 rounded-lg"
                                    />
                                    <div className="text-center">
                                        <p className="text-xs text-slate-500 mb-1">Manual entry key:</p>
                                        <code className="text-sm font-mono bg-slate-100 px-3 py-1 rounded-md border border-slate-200 tracking-widest">
                                            {mfaSetupData.secret}
                                        </code>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="mfaCode">Verification Code</Label>
                                <div className="flex gap-3">
                                    <Input
                                        id="mfaCode"
                                        placeholder="000000"
                                        maxLength={6}
                                        value={mfaCode}
                                        onChange={e => setMfaCode(e.target.value.replace(/\D/g, ""))}
                                        className="max-w-[160px] text-center text-lg tracking-widest font-mono"
                                    />
                                    <Button onClick={handleVerifyMfa} isLoading={isMfaLoading} className="bg-indigo-600 hover:bg-indigo-700">
                                        Verify & Enable
                                    </Button>
                                    <Button variant="outline" onClick={() => { setMfaSetupStep("idle"); setMfaSetupData(null); setMfaCode(""); }}>
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Disable MFA Modal */}
            <Modal
                isOpen={isDisableMfaModalOpen}
                onClose={() => setIsDisableMfaModalOpen(false)}
                title="Disable Two-Factor Authentication"
                description="Enter your current TOTP code to confirm disabling MFA."
            >
                <div className="space-y-4">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                        Disabling MFA will reduce your account security. Make sure this is intentional.
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="disableMfaCode">Current TOTP Code</Label>
                        <Input
                            id="disableMfaCode"
                            placeholder="000000"
                            maxLength={6}
                            value={disableMfaCode}
                            onChange={e => setDisableMfaCode(e.target.value.replace(/\D/g, ""))}
                            className="max-w-[160px] text-center text-lg tracking-widest font-mono"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button variant="outline" onClick={() => setIsDisableMfaModalOpen(false)}>Cancel</Button>
                        <Button
                            isLoading={isMfaLoading}
                            onClick={handleDisableMfa}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Disable MFA
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
