"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Check, Eye, EyeOff, Loader2, MailX, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invitationService } from "@/services/invitationService";
import { applyApiFieldErrors, reportFormErrors } from "@/lib/api-validation";
import { extractErrorMessage } from "@/lib/error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { loginPathAfterAccepting } from "@/lib/login-organisations";
import { PASSWORD_INPUT_PROPS, passwordRules } from "@/lib/password-policy";
import { formatLocalDate } from "@/lib/local-date";
import type { InvitationInvalidReason, InvitationPreview, PermissionDescription } from "@/types/invitations";

const L = FIELD_LIMITS.invitationAccept;

interface AcceptFormValues {
    firstName: string;
    lastName: string;
    password: string;
    phone: string;
    jobTitle: string;
}

/**
 * What each of the four invalid reasons means, and what the person can do next.
 * A dead link is not an error — it is an ordinary outcome with an explanation
 * the invitee can act on, so none of these renders as an error page.
 */
const INVALID_COPY: Record<InvitationInvalidReason, { title: string; body: string; cta: string | null }> = {
    EXPIRED: {
        title: "This invitation has expired",
        body: "Invitations are only valid for a limited time. Ask whoever invited you to send a new one — it takes them a moment.",
        cta: null,
    },
    REVOKED: {
        title: "This invitation was withdrawn",
        body: "Someone in the organisation cancelled it. If you think that was a mistake, ask them to invite you again.",
        cta: null,
    },
    ACCEPTED: {
        title: "This invitation has already been used",
        body: "The account exists, so there is nothing left to set up. Sign in with the password you chose. If you have forgotten it, use the forgotten-password link on the sign-in page.",
        cta: "Go to sign in",
    },
    UNKNOWN: {
        title: "We don't recognise this link",
        body: "The link may have been cut short by an email client, or replaced by a newer invitation to the same address. Copy it again from the message, or ask for a fresh one.",
        cta: null,
    },
};

/** Groups the catalogue entries the way the API grouped them, order preserved. */
function byGroup(permissions: PermissionDescription[]): [string, PermissionDescription[]][] {
    const groups = new Map<string, PermissionDescription[]>();
    for (const permission of permissions) {
        const bucket = groups.get(permission.group);
        if (bucket) bucket.push(permission);
        else groups.set(permission.group, [permission]);
    }
    return [...groups.entries()];
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-2xl">{children}</div>
        </div>
    );
}

/**
 * Joining an organisation on an invitation.
 *
 * Public by design — the visitor has no account, which is the point — so
 * `/accept-invite` is listed in `PUBLIC_PATHS` and the app shell renders it
 * without a session, a profile fetch or a permission fetch.
 *
 * The token arrives in the query string because an email link has nowhere else
 * to put it, and it is a credential, so it is read exactly once on mount and
 * then removed from the address bar with `replaceState`. After that it lives in
 * component state and travels in a POST body: it is never in a referrer header,
 * never in browser history, and never in anything a later navigation leaks.
 */
export default function AcceptInvitePage() {
    // Read during the first render rather than in an effect: an effect would
    // mean one render where the page believes there is no token and says so.
    const [token] = useState<string>(() => {
        if (typeof window === "undefined") return "";
        return new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
    });
    const [showPassword, setShowPassword] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const formErrorRef = useRef<HTMLDivElement>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Strip the token from the URL. Anything the user does next — a refresh, a
    // link out, the browser's own history — no longer carries it.
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.location.search) {
            window.history.replaceState(null, "", window.location.pathname);
        }
    }, []);

    const preview = useQuery<InvitationPreview>({
        queryKey: ["invitation", "preview"],
        queryFn: () => invitationService.lookup(token),
        enabled: token.length > 0,
        // The token is spent by accepting; re-running the lookup behind the
        // user's back would only ever produce a worse answer.
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        retry: false,
    });

    const accept = useMutation({
        mutationFn: (values: AcceptFormValues) =>
            invitationService.accept({
                token,
                firstName: values.firstName.trim(),
                lastName: values.lastName.trim(),
                password: values.password,
                ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
                ...(values.jobTitle.trim() ? { jobTitle: values.jobTitle.trim() } : {}),
            }),
    });

    const invitation = preview.data;
    const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<AcceptFormValues>({
        defaultValues: { firstName: "", lastName: "", password: "", phone: "", jobTitle: "" },
    });

    // The invitation may pre-fill a name; it arrives after the form is mounted.
    const prefilled = useRef(false);
    useEffect(() => {
        if (prefilled.current || !invitation?.valid) return;
        prefilled.current = true;
        reset({
            firstName: invitation.firstName ?? "",
            lastName: invitation.lastName ?? "",
            password: "",
            phone: "",
            jobTitle: "",
        });
    }, [invitation, reset]);

    // Focus moves to whatever the lookup turned out to be — the offer, or the
    // explanation of why there isn't one. Without this a screen-reader user is
    // left at the top of a page that silently replaced its own contents.
    useEffect(() => {
        if (!preview.isPending) headingRef.current?.focus();
    }, [preview.isPending]);

    useEffect(() => {
        if (submitError) formErrorRef.current?.focus();
    }, [submitError]);

    const onSubmit = async (values: AcceptFormValues) => {
        setSubmitError(null);
        try {
            const result = await accept.mutateAsync(values);
            // No session is issued, so the only honest next step is the login
            // page — carrying the organisation, because this address may exist
            // in more than one of them.
            window.location.assign(loginPathAfterAccepting(result.organisationId, result.email));
        } catch (error) {
            const marked = applyApiFieldErrors(error, setError);
            setSubmitError(
                marked > 0
                    ? "Some details need fixing before your account can be created."
                    : extractErrorMessage(error, "Your account could not be created. Please try again."),
            );
        }
    };

    // ── No token at all ───────────────────────────────────────────────────────
    if (!token) {
        return (
            <Shell>
                <Card>
                    <CardHeader>
                        <MailX aria-hidden="true" className="h-8 w-8 text-muted-fg" />
                        <CardTitle ref={headingRef} tabIndex={-1} className="outline-none">
                            This page needs an invitation link
                        </CardTitle>
                        <CardDescription>
                            Open the link from your invitation email. Copy the whole address — some email clients break long links across lines.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline"><Link href="/login">Go to sign in</Link></Button>
                    </CardContent>
                </Card>
            </Shell>
        );
    }

    // ── Looking the token up ──────────────────────────────────────────────────
    if (preview.isPending) {
        return (
            <Shell>
                <Card>
                    <CardContent className="flex items-center gap-3 p-8 text-sm text-muted-fg">
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        <span role="status">Checking your invitation…</span>
                    </CardContent>
                </Card>
            </Shell>
        );
    }

    // ── The lookup itself failed ──────────────────────────────────────────────
    //
    // Distinct from an invalid token: that answers 200 with a reason. Reaching
    // here means the request did not complete, and telling the invitee their
    // link is bad would be a guess.
    if (preview.isError || !invitation) {
        return (
            <Shell>
                <Alert
                    tone="danger"
                    title="We couldn't check your invitation"
                    action={
                        <Button size="sm" variant="outline" onClick={() => void preview.refetch()} isLoading={preview.isFetching}>
                            Try again
                        </Button>
                    }
                >
                    {extractErrorMessage(preview.error, "The server didn't respond. This is usually temporary — your link is still fine.")}
                </Alert>
            </Shell>
        );
    }

    // ── A token that cannot be redeemed ───────────────────────────────────────
    if (!invitation.valid) {
        const copy = INVALID_COPY[invitation.reason ?? "UNKNOWN"] ?? INVALID_COPY.UNKNOWN;
        return (
            <Shell>
                <Card>
                    <CardHeader>
                        <MailX aria-hidden="true" className="h-8 w-8 text-warn" />
                        <CardTitle ref={headingRef} tabIndex={-1} className="outline-none" data-testid="invalid-title">
                            {copy.title}
                        </CardTitle>
                        <CardDescription>{copy.body}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 sm:flex-row">
                        <Button asChild variant={copy.cta ? "default" : "outline"}>
                            <Link href="/login">{copy.cta ?? "Go to sign in"}</Link>
                        </Button>
                    </CardContent>
                </Card>
            </Shell>
        );
    }

    // ── The offer, and the form that takes it ─────────────────────────────────
    //
    // Only enforced permissions are listed. A permission that gates nothing
    // today would be a promise to the invitee that the product does not keep,
    // and unlike an administrator they have no use for the distinction.
    const abilities = invitation.permissions.filter((permission) => permission.enforced);
    const groups = byGroup(abilities);

    return (
        <Shell>
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2 text-sm font-semibold text-brand">
                            <Building2 aria-hidden="true" className="h-4 w-4" />
                            {invitation.organisationName}
                        </div>
                        <CardTitle ref={headingRef} tabIndex={-1} className="outline-none">
                            {invitation.invitedByName
                                ? `${invitation.invitedByName} invited you to join ${invitation.organisationName}`
                                : `You have been invited to join ${invitation.organisationName}`}
                        </CardTitle>
                        <CardDescription>
                            The invitation was sent to <strong className="text-foreground">{invitation.email}</strong>
                            {invitation.expiresAt ? <> and is valid until {formatLocalDate(invitation.expiresAt)}</> : null}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {invitation.note ? (
                            <blockquote className="border-l-2 border-edge pl-3 text-sm text-muted-fg italic">
                                “{invitation.note}”
                            </blockquote>
                        ) : null}

                        <div className="rounded-card border border-edge bg-surface-muted p-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-brand" />
                                <p className="text-sm font-semibold text-foreground">
                                    You will join as {invitation.roleName ?? "a member"}
                                </p>
                            </div>
                            {invitation.roleDescription ? (
                                <p className="mt-1 text-[13px] text-muted-fg">{invitation.roleDescription}</p>
                            ) : null}

                            {groups.length === 0 ? (
                                <p className="mt-3 text-[13px] text-muted-fg">
                                    This role carries no permissions yet. You will be able to sign in, and an administrator
                                    can give you access to the parts of AssetIQ you need.
                                </p>
                            ) : (
                                <div className="mt-3 space-y-3">
                                    <p className="text-[13px] font-semibold text-foreground">Here is what you will be able to do:</p>
                                    {groups.map(([group, entries]) => (
                                        <div key={group}>
                                            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint-fg">{group}</p>
                                            <ul className="mt-1 space-y-1">
                                                {entries.map((permission) => (
                                                    <li key={permission.key} className="flex gap-2 text-[13px] text-muted-fg">
                                                        <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                                                        <span>
                                                            <span className="font-medium text-foreground">{permission.label}</span>
                                                            {" — "}
                                                            {permission.summary}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Set up your account</CardTitle>
                        <CardDescription>
                            Your email address is already confirmed, so you can sign in as soon as this is done.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="space-y-4">
                            {submitError ? (
                                <Alert ref={formErrorRef} tone="danger" title="We couldn't create your account" data-testid="accept-error">
                                    {submitError}
                                </Alert>
                            ) : null}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="acc-first">First name <span className="text-danger">*</span></Label>
                                    <Input
                                        id="acc-first"
                                        autoComplete="given-name"
                                        aria-invalid={errors.firstName ? true : undefined}
                                        aria-describedby={errors.firstName ? "acc-first-error" : undefined}
                                        {...limitInputProps(L.firstName)}
                                        {...register("firstName", limitRules<AcceptFormValues, "firstName">(L.firstName, "First name"))}
                                    />
                                    <FieldError id="acc-first-error" error={errors.firstName} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="acc-last">Last name <span className="text-danger">*</span></Label>
                                    <Input
                                        id="acc-last"
                                        autoComplete="family-name"
                                        aria-invalid={errors.lastName ? true : undefined}
                                        aria-describedby={errors.lastName ? "acc-last-error" : undefined}
                                        {...limitInputProps(L.lastName)}
                                        {...register("lastName", limitRules<AcceptFormValues, "lastName">(L.lastName, "Last name"))}
                                    />
                                    <FieldError id="acc-last-error" error={errors.lastName} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="acc-password">Choose a password <span className="text-danger">*</span></Label>
                                <div className="relative">
                                    <Input
                                        id="acc-password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        className="pr-10"
                                        aria-invalid={errors.password ? true : undefined}
                                        aria-describedby={errors.password ? "acc-password-error" : "acc-password-hint"}
                                        {...PASSWORD_INPUT_PROPS}
                                        {...register("password", passwordRules())}
                                    />
                                    <button
                                        type="button"
                                        aria-label={showPassword ? "Mask password" : "Show password"}
                                        onClick={() => setShowPassword((value) => !value)}
                                        className="ea-focus absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-control text-muted-fg hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p id="acc-password-hint" className="text-xs text-faint-fg">At least 8 characters.</p>
                                <FieldError id="acc-password-error" error={errors.password} />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="acc-phone">Phone</Label>
                                    <Input
                                        id="acc-phone"
                                        type="tel"
                                        autoComplete="tel"
                                        {...limitInputProps(L.phone)}
                                        {...register("phone", limitRules<AcceptFormValues, "phone">(L.phone, "Phone"))}
                                    />
                                    <FieldError error={errors.phone} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="acc-title">Job title</Label>
                                    <Input
                                        id="acc-title"
                                        autoComplete="organization-title"
                                        {...limitInputProps(L.jobTitle)}
                                        {...register("jobTitle", limitRules<AcceptFormValues, "jobTitle">(L.jobTitle, "Job title"))}
                                    />
                                    <FieldError error={errors.jobTitle} />
                                </div>
                            </div>

                            <Button type="submit" className="w-full" isLoading={accept.isPending}>
                                {accept.isPending ? "Creating your account…" : `Join ${invitation.organisationName}`}
                            </Button>
                            <p className="text-center text-xs text-muted-fg">
                                Already have an account here? <Link href="/login" className="font-semibold text-brand underline underline-offset-4">Sign in instead</Link>
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </Shell>
    );
}
