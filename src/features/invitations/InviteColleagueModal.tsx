"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field-error";
import { notify } from "@/lib/notify";
import { applyApiFieldErrors, reportFormErrors } from "@/lib/api-validation";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { describeInvitationError, useInviteColleague } from "@/features/invitations/hooks";
import type { InvitationIssued, InviteUserRequest } from "@/types/invitations";

const L = FIELD_LIMITS.invitation;

interface Option {
    id: string;
    name: string;
}

/** The form's own shape: every control is a string, as HTML gives them. */
interface InviteFormValues {
    email: string;
    roleId: string;
    departmentId: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    note: string;
}

const EMPTY: InviteFormValues = {
    email: "",
    roleId: "",
    departmentId: "",
    firstName: "",
    lastName: "",
    jobTitle: "",
    note: "",
};

/**
 * Inviting a colleague.
 *
 * Every way this can fail is a sentence the API already wrote — "already a
 * member", "that role grants permissions you do not hold", "no seat free",
 * "too many invitations just now" — so the form shows that sentence, inline,
 * above the fields, and keeps what was typed. A toast would be the wrong
 * channel: the condition is still true and the user is still looking at the
 * form that caused it.
 */
export function InviteColleagueModal({
    isOpen,
    onClose,
    roles,
    departments,
    onIssued,
}: {
    isOpen: boolean;
    onClose: () => void;
    roles: Option[];
    departments: Option[];
    /** Called with the API's answer, which may carry a link to pass on by hand. */
    onIssued: (issued: InvitationIssued) => void;
}) {
    const invite = useInviteColleague();
    const [submitError, setSubmitError] = useState<string | null>(null);
    const errorRef = useRef<HTMLDivElement>(null);

    // Mounted only while open (see InvitationsSection), so the defaults *are*
    // the reset: a cancelled invitation leaves nothing behind for the next one.
    const { register, handleSubmit, setError, formState: { errors } } = useForm<InviteFormValues>({
        defaultValues: EMPTY,
    });

    // A failure that arrives after a click is invisible to a keyboard or screen
    // reader user unless something moves; the alert takes focus so it is read
    // and so Tab lands back in the form.
    useEffect(() => {
        if (submitError) errorRef.current?.focus();
    }, [submitError]);

    const onSubmit = async (values: InviteFormValues) => {
        setSubmitError(null);
        const body: InviteUserRequest = {
            email: values.email.trim(),
            roleId: values.roleId,
            ...(values.departmentId ? { departmentId: values.departmentId } : {}),
            ...(values.firstName.trim() ? { firstName: values.firstName.trim() } : {}),
            ...(values.lastName.trim() ? { lastName: values.lastName.trim() } : {}),
            ...(values.jobTitle.trim() ? { jobTitle: values.jobTitle.trim() } : {}),
            ...(values.note.trim() ? { note: values.note.trim() } : {}),
        };
        try {
            const issued = await invite.mutateAsync(body);
            onIssued(issued);
            if (issued.emailSent) {
                notify.success(`Invitation sent to ${issued.invitation.email}`);
            }
            onClose();
        } catch (error) {
            // Field-level problems (a malformed address, a role that is not in
            // this organisation) land on their control; everything else is the
            // sentence above the form.
            const marked = applyApiFieldErrors(error, setError, { roleId: "roleId", departmentId: "departmentId" });
            setSubmitError(
                marked > 0
                    ? "Some details need fixing before this invitation can be sent."
                    : describeInvitationError(error, "The invitation could not be sent."),
            );
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Invite a colleague"
            description="They choose their own password when they accept. You choose what they can do."
        >
            <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="space-y-4">
                {submitError ? (
                    <Alert ref={errorRef} tone="danger" title="This invitation was not sent" data-testid="invite-error">
                        {submitError}
                    </Alert>
                ) : null}

                <div className="space-y-2">
                    <Label htmlFor="inv-email">Email address <span className="text-danger">*</span></Label>
                    <Input
                        id="inv-email"
                        type="email"
                        autoComplete="off"
                        placeholder="name@company.com"
                        aria-invalid={errors.email ? true : undefined}
                        aria-describedby={errors.email ? "inv-email-error" : undefined}
                        {...limitInputProps(L.email)}
                        {...register("email", limitRules<InviteFormValues, "email">(L.email, "Email address"))}
                    />
                    <FieldError id="inv-email-error" error={errors.email} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="inv-role">Role <span className="text-danger">*</span></Label>
                        <Select
                            id="inv-role"
                            aria-invalid={errors.roleId ? true : undefined}
                            aria-describedby={errors.roleId ? "inv-role-error" : undefined}
                            {...register("roleId", { required: "Choose the role this person should have" })}
                        >
                            <option value="">Choose a role…</option>
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                        </Select>
                        <FieldError id="inv-role-error" error={errors.roleId} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="inv-department">Department</Label>
                        <Select id="inv-department" {...register("departmentId")}>
                            <option value="">None</option>
                            {departments.map((department) => (
                                <option key={department.id} value={department.id}>{department.name}</option>
                            ))}
                        </Select>
                        <FieldError error={errors.departmentId} />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="inv-first">First name</Label>
                        <Input
                            id="inv-first"
                            {...limitInputProps(L.firstName)}
                            {...register("firstName", limitRules<InviteFormValues, "firstName">(L.firstName, "First name"))}
                        />
                        <FieldError error={errors.firstName} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="inv-last">Last name</Label>
                        <Input
                            id="inv-last"
                            {...limitInputProps(L.lastName)}
                            {...register("lastName", limitRules<InviteFormValues, "lastName">(L.lastName, "Last name"))}
                        />
                        <FieldError error={errors.lastName} />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="inv-title">Job title</Label>
                    <Input
                        id="inv-title"
                        {...limitInputProps(L.jobTitle)}
                        {...register("jobTitle", limitRules<InviteFormValues, "jobTitle">(L.jobTitle, "Job title"))}
                    />
                    <FieldError error={errors.jobTitle} />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="inv-note">Note</Label>
                    <Textarea
                        id="inv-note"
                        rows={3}
                        placeholder="Shown to them on the invitation screen."
                        {...limitInputProps(L.note)}
                        {...register("note", limitRules<InviteFormValues, "note">(L.note, "Note"))}
                    />
                    <p className="text-xs text-faint-fg">Optional. They see this alongside the role you picked.</p>
                    <FieldError error={errors.note} />
                </div>

                <p className="text-xs text-muted-fg">
                    Names you fill in here only pre-fill their form — they can correct them. The role and department are yours to set.
                </p>

                <div className="flex flex-col-reverse gap-2 border-t border-edge-subtle pt-4 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" isLoading={invite.isPending}>Send invitation</Button>
                </div>
            </form>
        </Modal>
    );
}
