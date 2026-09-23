"use client";

import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { KeyRound } from "lucide-react";
import { userService } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { reportApiError, reportFormErrors } from "@/lib/api-validation";
import { PASSWORD_INPUT_PROPS, passwordRules } from "@/lib/password-policy";

export interface ChangePasswordForm {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

/**
 * Change your own password (POST /users/me/password). The API checks the current
 * password and signs out every session afterwards, so `onChanged` should send the
 * user to sign in again.
 */
export function ChangePasswordCard({ onChanged }: { onChanged: () => void }) {
    const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<ChangePasswordForm>({
        defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    });

    const onSubmit = async (data: ChangePasswordForm) => {
        try {
            await userService.changeMyPassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
            reset();
            toast.success("Password changed. Sign in again with your new password.");
            onChanged();
        } catch (error) {
            reportApiError(error, { fallback: "Failed to change password", setError });
        }
    };

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5" /> Change password
                </CardTitle>
                <CardDescription>Changing your password signs you out everywhere, including here.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="grid max-w-xl gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current password</Label>
                        <Input
                            id="currentPassword"
                            type="password"
                            autoComplete="current-password"
                            {...register("currentPassword", { required: "Enter your current password" })}
                        />
                        <FieldError error={errors.currentPassword} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="newPassword">New password</Label>
                        <Input
                            id="newPassword"
                            type="password"
                            autoComplete="new-password"
                            {...PASSWORD_INPUT_PROPS}
                            {...register("newPassword", {
                                ...passwordRules("Enter a new password"),
                                validate: {
                                    policy: passwordRules().validate,
                                    differs: (v, values) =>
                                        v !== values.currentPassword || "Choose a password different from the current one",
                                },
                            })}
                        />
                        <FieldError error={errors.newPassword} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm new password</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            {...register("confirmPassword", {
                                required: "Confirm the new password",
                                validate: (v, values) => v === values.newPassword || "The passwords do not match",
                            })}
                        />
                        <FieldError error={errors.confirmPassword} />
                    </div>
                    <div className="flex justify-end border-t border-edge-subtle pt-4">
                        <Button type="submit" isLoading={isSubmitting}>Change password</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
