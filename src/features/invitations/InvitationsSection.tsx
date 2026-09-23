"use client";

import { useMemo, useState } from "react";
import { MailPlus, RotateCw, Ban } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { useConfirm } from "@/hooks/useConfirm";
import { notify } from "@/lib/notify";
import { formatRelativeTime } from "@/lib/time";
import { InviteColleagueModal } from "@/features/invitations/InviteColleagueModal";
import { IssuedLinkNotice } from "@/features/invitations/IssuedLinkNotice";
import {
    describeInvitationError,
    useInvitations,
    useResendInvitation,
    useRevokeInvitation,
} from "@/features/invitations/hooks";
import type { InvitationIssued, InvitationStatus, UserInvitation } from "@/types/invitations";

const PAGE_SIZE = 25;

const STATUS_FILTERS: { value: "" | InvitationStatus; label: string }[] = [
    { value: "", label: "All invitations" },
    { value: "PENDING", label: "Pending" },
    { value: "ACCEPTED", label: "Accepted" },
    { value: "REVOKED", label: "Revoked" },
    { value: "EXPIRED", label: "Expired" },
];

/**
 * The shared status vocabulary reads ACCEPTED as "waiting on something"
 * (its compliance sense). For an invitation it is the happy ending, so these
 * four are pinned rather than derived.
 */
const STATUS_TONE = {
    PENDING: "reserved",
    ACCEPTED: "in-use",
    REVOKED: "disposed",
    EXPIRED: "retired",
} as const;

const fullName = (invitation: UserInvitation): string =>
    [invitation.firstName, invitation.lastName].filter(Boolean).join(" ");

/**
 * Invitations that have been sent, and the one button that sends another.
 *
 * Lives beside the user list because an invitation *is* a user account, on a
 * delay: the same administrator, the same role decision, the same seat against
 * the plan. Splitting them onto separate screens would hide the fact that three
 * pending invitations are three of your seats.
 */
export function InvitationsSection({
    roles,
    departments,
    canManage,
}: {
    roles: { id: string; name: string }[];
    departments: { id: string; name: string }[];
    /** MANAGE_USERS. Without it the list is readable and nothing is actionable. */
    canManage: boolean;
}) {
    const [status, setStatus] = useState<"" | InvitationStatus>("");
    const [page, setPage] = useState(0);
    const [isInviteOpen, setInviteOpen] = useState(false);
    const [issued, setIssued] = useState<InvitationIssued | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const params = useMemo(
        () => ({ ...(status ? { status } : {}), limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
        [status, page],
    );
    const { data, isLoading, error, refetch, isFetching } = useInvitations(params);
    const invitations = data?.items ?? [];

    const resend = useResendInvitation();
    const revoke = useRevokeInvitation();
    const { confirm, ConfirmDialog } = useConfirm();

    const onIssued = (next: InvitationIssued) => {
        setActionError(null);
        // Only kept when there is something to show: `acceptUrl` is null
        // whenever the email actually went out.
        setIssued(next.emailSent ? null : next);
    };

    const handleResend = async (invitation: UserInvitation) => {
        setActionError(null);
        try {
            const next = await resend.mutateAsync(invitation.id);
            onIssued(next);
            if (next.emailSent) notify.success(`Invitation resent to ${invitation.email}`);
        } catch (err) {
            setActionError(describeInvitationError(err, `The invitation to ${invitation.email} could not be resent.`));
        }
    };

    const handleRevoke = async (invitation: UserInvitation) => {
        const confirmed = await confirm({
            message: `Revoke the invitation to ${invitation.email}? Their link stops working immediately.`,
            variant: "danger",
        });
        if (!confirmed) return;
        setActionError(null);
        try {
            await revoke.mutateAsync(invitation.id);
            setIssued(null);
            notify.success(`Invitation to ${invitation.email} revoked`);
        } catch (err) {
            setActionError(describeInvitationError(err, `The invitation to ${invitation.email} could not be revoked.`));
        }
    };

    const columns = useMemo<ColumnDef<UserInvitation, unknown>[]>(
        () => [
            {
                accessorKey: "email",
                header: "Invited",
                cell: ({ row }) => (
                    <div className="min-w-0 max-w-56">
                        <p className="truncate font-semibold text-foreground">{row.original.email}</p>
                        <p className="truncate text-xs text-faint-fg">
                            {[fullName(row.original), row.original.jobTitle].filter(Boolean).join(" · ") || "No name given"}
                        </p>
                    </div>
                ),
            },
            {
                id: "role",
                header: "Role",
                enableSorting: false,
                cell: ({ row }) => <span className="text-muted-fg">{row.original.roleName ?? "—"}</span>,
            },
            {
                id: "department",
                header: "Department",
                enableSorting: false,
                cell: ({ row }) => <span className="text-muted-fg">{row.original.departmentName ?? "—"}</span>,
            },
            {
                accessorKey: "status",
                header: "Status",
                cell: ({ row }) => (
                    <StatusBadge status={row.original.status} tone={STATUS_TONE[row.original.status] ?? undefined} />
                ),
            },
            {
                id: "sent",
                header: "Last sent",
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="text-xs text-muted-fg">
                        <p>{row.original.lastSentAt ? formatRelativeTime(row.original.lastSentAt) : "Not sent"}</p>
                        <p className="text-faint-fg">
                            {row.original.emailDelivered
                                ? `${row.original.sendCount} email${row.original.sendCount === 1 ? "" : "s"}`
                                : "Email not delivered"}
                        </p>
                    </div>
                ),
            },
            {
                id: "expires",
                header: "Expires",
                enableSorting: false,
                cell: ({ row }) =>
                    row.original.status === "PENDING" && row.original.expiresAt ? (
                        <span className="text-xs text-muted-fg">{formatRelativeTime(row.original.expiresAt)}</span>
                    ) : (
                        <span className="text-xs text-faint-fg">—</span>
                    ),
            },
            {
                id: "actions",
                header: "",
                enableSorting: false,
                cell: ({ row }) =>
                    !canManage || row.original.status !== "PENDING" ? null : (
                        <div className="flex justify-end gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7"
                                onClick={() => void handleResend(row.original)}
                                isLoading={resend.isPending && resend.variables === row.original.id}
                                aria-label={`Resend the invitation to ${row.original.email}`}
                            >
                                <RotateCw aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Resend
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-danger"
                                onClick={() => void handleRevoke(row.original)}
                                aria-label={`Revoke the invitation to ${row.original.email}`}
                            >
                                <Ban aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Revoke
                            </Button>
                        </div>
                    ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [canManage, resend.isPending, resend.variables],
    );

    const total = data?.total ?? 0;

    return (
        <section aria-labelledby="invitations-heading" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 id="invitations-heading" className="text-base font-bold text-foreground">Invitations</h2>
                    <p className="text-[13px] text-muted-fg">
                        People who have been invited but have not signed in yet. A pending invitation holds a seat on your plan.
                    </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                        <Label htmlFor="inv-status" className="text-xs text-muted-fg">Show</Label>
                        <Select
                            id="inv-status"
                            className="w-44"
                            value={status}
                            onChange={(event) => {
                                setStatus(event.target.value as "" | InvitationStatus);
                                setPage(0);
                            }}
                        >
                            {STATUS_FILTERS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Select>
                    </div>
                    {canManage ? (
                        <Button onClick={() => setInviteOpen(true)}>
                            <MailPlus aria-hidden="true" className="mr-2 h-4 w-4" /> Invite colleague
                        </Button>
                    ) : null}
                </div>
            </div>

            {issued ? <IssuedLinkNotice issued={issued} onDismiss={() => setIssued(null)} /> : null}

            {actionError ? (
                <Alert
                    tone="danger"
                    title="That didn't work"
                    data-testid="invitation-action-error"
                    action={<Button size="sm" variant="outline" onClick={() => setActionError(null)}>Dismiss</Button>}
                >
                    {actionError}
                </Alert>
            ) : null}

            <DataTable
                columns={columns}
                data={invitations}
                isLoading={isLoading}
                error={error}
                onRetry={refetch}
                isRetrying={isFetching}
                errorWhat="your invitations"
                pageInfo={{
                    page,
                    size: PAGE_SIZE,
                    totalElements: total,
                    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
                }}
                onPageChange={setPage}
                emptyTitle={status ? "No invitations with that status" : "No invitations yet"}
                emptyDescription={
                    status
                        ? "Change the filter to see the rest."
                        : "Invite a colleague and they choose their own password when they accept."
                }
                emptyAction={
                    canManage && !status ? (
                        <Button size="sm" onClick={() => setInviteOpen(true)}>
                            <MailPlus aria-hidden="true" className="mr-1.5 h-4 w-4" /> Invite colleague
                        </Button>
                    ) : undefined
                }
            />

            {isInviteOpen ? (
                <InviteColleagueModal
                    isOpen
                    onClose={() => setInviteOpen(false)}
                    roles={roles}
                    departments={departments}
                    onIssued={onIssued}
                />
            ) : null}
            {ConfirmDialog}
        </section>
    );
}
