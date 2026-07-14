"use client";

import { useState, useEffect } from "react";
import { User, UserDto, MfaSetupResponse } from "@/types";
import { userService } from "@/services/userService";
import { organisationService } from "@/services/organisationService";
import { departmentService } from "@/services/departmentService";
import { roleService } from "@/services/roleService";
import { mfaService } from "@/services/mfaService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { UserCircle, Mail, Phone, Building, Briefcase, Shield, Save, ShieldCheck, ShieldOff } from "lucide-react";
import { buildPatchPayload } from "@/lib/patch";
import { mergeStoredUser, verifyOrganisationContext } from "@/lib/authContext";
import { extractErrorMessage } from "@/lib/error";

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [organisatonName, setOrganisationName] = useState<string>("Loading...");
    const [departmentName, setDepartmentName] = useState<string>("");
    const [roleName, setRoleName] = useState<string>("");

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
                mergeStoredUser(freshUser);
                verifyOrganisationContext(freshUser);
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

                // Fetch Organisation, Department, and Role names in parallel
                const [orgResult, deptResult, roleResult] = await Promise.allSettled([
                    freshUser.organisationId ? organisationService.get(freshUser.organisationId) : Promise.resolve(null),
                    freshUser.departmentId ? departmentService.get(freshUser.departmentId) : Promise.resolve(null),
                    freshUser.roleId ? roleService.get(freshUser.roleId) : Promise.resolve(null),
                ]);

                if (orgResult.status === "fulfilled") {
                    setOrganisationName(orgResult.value?.name ?? "No Organisation Assigned");
                } else {
                    setOrganisationName("Unknown Organisation");
                }
                if (deptResult.status === "fulfilled" && deptResult.value) {
                    setDepartmentName(deptResult.value.name);
                }
                if (roleResult.status === "fulfilled" && roleResult.value) {
                    setRoleName(roleResult.value.name);
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
            mergeStoredUser(merged);
            verifyOrganisationContext(merged);
            setUser(merged);

            toast.success("Profile updated successfully");
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to update profile"));
            console.error(error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <PageSpinner />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
                <UserCircle className="h-16 w-16 text-faint-fg" />
                <h2 className="text-xl font-semibold text-foreground">Profile Not Found</h2>
                <p className="text-muted-fg">Please ensure you are logged in correctly.</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <PageHeader title="My Profile" subtitle="Manage your personal information and account preferences." />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card className="h-fit shadow-sm md:col-span-1">
                    <CardHeader className="pb-2 text-center">
                        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-brand to-purple-400 text-3xl font-bold text-white shadow-md ring-4 ring-[var(--surface)]">
                            {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <CardTitle className="text-xl">{user.firstName} {user.lastName}</CardTitle>
                        <CardDescription className="font-medium text-brand">{user.jobTitle || "Employee"}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 border-t border-edge-subtle pt-4">
                        <div className="flex items-center gap-3 text-sm text-muted-fg">
                            <Mail className="h-4 w-4 shrink-0 text-faint-fg" />
                            <span className="truncate">{user.email}</span>
                        </div>
                        {user.phone && (
                            <div className="flex items-center gap-3 text-sm text-muted-fg">
                                <Phone className="h-4 w-4 shrink-0 text-faint-fg" />
                                <span>{user.phone}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3 text-sm text-muted-fg">
                            <Building className="h-4 w-4 shrink-0 text-faint-fg" />
                            <span>{organisatonName}</span>
                        </div>
                        {(departmentName || user.departmentId) && (
                            <div className="flex items-center gap-3 text-sm text-muted-fg">
                                <Briefcase className="h-4 w-4 shrink-0 text-faint-fg" />
                                <span>{departmentName || "Department not found"}</span>
                            </div>
                        )}
                        <div className="mt-2 flex items-center gap-3 rounded-control border border-brand/20 bg-brand-soft p-2 text-sm font-medium text-brand">
                            <Shield className="h-4 w-4 shrink-0" />
                            <span>{roleName || "No role assigned"}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm md:col-span-2">
                    <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                        <CardDescription>Update your contact details and job title.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name <span className="text-danger">*</span></Label>
                                    <Input
                                        id="firstName"
                                        {...register("firstName", { required: "First name is required" })}
                                        className={errors.firstName ? "border-danger ring-danger" : ""}
                                    />
                                    {errors.firstName && <p className="text-sm text-danger">{errors.firstName.message as string}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name <span className="text-danger">*</span></Label>
                                    <Input
                                        id="lastName"
                                        {...register("lastName", { required: "Last name is required" })}
                                        className={errors.lastName ? "border-danger ring-danger" : ""}
                                    />
                                    {errors.lastName && <p className="text-sm text-danger">{errors.lastName.message as string}</p>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address <span className="text-danger">*</span></Label>
                                <Input
                                    id="email"
                                    type="email"
                                    {...register("email", {
                                        required: "Email is required",
                                        pattern: { value: /^\S+@\S+$/i, message: "Invalid email format" }
                                    })}
                                    className={errors.email ? "border-danger ring-danger" : ""}
                                />
                                {errors.email && <p className="text-sm text-danger">{errors.email.message as string}</p>}
                            </div>

                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

                            <div className="rounded-card border border-edge-subtle bg-surface-muted p-4 text-sm text-muted-fg">
                                <h4 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                                    <Shield className="h-4 w-4" /> Security & Access
                                </h4>
                                <p>To modify your organisation, department, or role permissions, please contact your system administrator. These fields are locked for security purposes.</p>
                            </div>

                            <div className="flex justify-end border-t border-edge-subtle pt-4">
                                <Button type="submit" isLoading={isSubmitting} className="min-w-[140px]">
                                    <Save className="mr-2 h-4 w-4" />
                                    {isSubmitting ? "Saving..." : "Save Changes"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-brand" />
                        Two-Factor Authentication
                    </CardTitle>
                    <CardDescription>
                        Add an extra layer of security using a TOTP authenticator app (e.g. Google Authenticator, Authy).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {mfaEnabled ? (
                        <div className="flex items-center justify-between rounded-card border border-ok/40 bg-ok-soft p-4">
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="h-6 w-6 text-ok" />
                                <div>
                                    <p className="font-semibold text-ok">MFA is enabled</p>
                                    <p className="text-sm text-ok/80">Your account is protected with two-factor authentication.</p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => { setIsDisableMfaModalOpen(true); setDisableMfaCode(""); }}
                                className="border-danger/40 text-danger hover:bg-danger-soft"
                            >
                                <ShieldOff className="mr-2 h-4 w-4" />
                                Disable MFA
                            </Button>
                        </div>
                    ) : mfaSetupStep === "idle" ? (
                        <div className="flex items-center justify-between rounded-card border border-edge-subtle bg-surface-muted p-4">
                            <div className="flex items-center gap-3">
                                <Shield className="h-6 w-6 text-faint-fg" />
                                <div>
                                    <p className="font-semibold text-foreground">MFA is not enabled</p>
                                    <p className="text-sm text-muted-fg">Enable MFA to secure your account with a TOTP code.</p>
                                </div>
                            </div>
                            <Button onClick={handleStartMfaSetup} isLoading={isMfaLoading}>
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                Enable MFA
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="rounded-card border border-info/40 bg-info-soft p-4 text-sm text-info">
                                Scan the QR code below with your authenticator app, then enter the 6-digit code to confirm.
                            </div>
                            {mfaSetupData && (
                                <div className="flex flex-col items-center gap-4">
                                    <img
                                        src={mfaSetupData.qrCodeImage}
                                        alt="MFA QR Code"
                                        className="h-48 w-48 rounded-card border border-edge-subtle"
                                    />
                                    <div className="text-center">
                                        <p className="mb-1 text-xs text-faint-fg">Manual entry key:</p>
                                        <code className="data-mono rounded-control border border-edge-subtle bg-surface-muted px-3 py-1 text-sm tracking-widest text-foreground">
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
                                        className="data-mono max-w-[160px] text-center text-lg tracking-widest"
                                    />
                                    <Button onClick={handleVerifyMfa} isLoading={isMfaLoading}>
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

            <Modal
                isOpen={isDisableMfaModalOpen}
                onClose={() => setIsDisableMfaModalOpen(false)}
                title="Disable Two-Factor Authentication"
                description="Enter your current TOTP code to confirm disabling MFA."
            >
                <div className="space-y-4">
                    <div className="rounded-card border border-warn/40 bg-warn-soft p-3 text-sm text-warn">
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
                            className="data-mono max-w-[160px] text-center text-lg tracking-widest"
                        />
                    </div>
                    <div className="flex justify-end gap-2 border-t border-edge-subtle pt-2">
                        <Button variant="outline" onClick={() => setIsDisableMfaModalOpen(false)}>Cancel</Button>
                        <Button
                            isLoading={isMfaLoading}
                            onClick={handleDisableMfa}
                            className="bg-danger text-white hover:bg-danger/90"
                        >
                            Disable MFA
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
