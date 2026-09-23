"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Search, CheckCircle2, AlertTriangle, User } from "lucide-react";
import { dsarService, DSAR_PAGE_SIZE, type DsarDto, type DsarType, type DsarStatus, type DsarStatusUpdate, type DsarSubmission } from "@/services/dsarService";
import { reportApiError, applyApiFieldErrors, reportFormErrors } from "@/lib/api-validation";
import { usePermissions } from "@/contexts/PermissionContext";
import { buildDsarStatusUpdate, dsarNextStatuses, isDsarClosed, type DsarUpdateForm } from "@/features/dpa/dsar";
import { userService } from "@/services/userService";
import { qk } from "@/lib/queryClient";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { StatusBadge } from "@/components/ui/status-badge";

const REQUEST_TYPES: { value: DsarType; label: string }[] = [
  { value: "ACCESS", label: "Access" },
  { value: "ERASURE", label: "Erasure (right to be forgotten)" },
  { value: "RECTIFICATION", label: "Rectification" },
  { value: "PORTABILITY", label: "Portability" },
  { value: "OBJECTION", label: "Objection" },
];

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const daysLeft = (d?: string) => (d ? Math.round((new Date(d).getTime() - Date.now()) / 86400000) : null);

type SubmitForm = DsarSubmission;

const L = FIELD_LIMITS.dsar;

export default function DsarPage() {
  const queryClient = useQueryClient();
  const dsarKey = qk.module("dsar");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DsarStatus | "">("");
  const [page, setPage] = useState(0);

  // The list is paged server-side: the screen used to pull 200 rows and silently
  // drop anything beyond them. The status filter goes to the API; the free-text
  // search narrows the page that is on screen.
  const { data: pageData, isLoading } = useQuery({
    queryKey: [...dsarKey.list(), statusFilter, page],
    queryFn: () => dsarService.list({ page, status: statusFilter }),
  });
  const requests = useMemo(() => pageData?.items ?? [], [pageData]);
  const total = pageData?.total ?? 0;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: dsarKey.all });

  const submitDsar = useMutation({
    mutationFn: (data: SubmitForm) => dsarService.submit(data),
    onSuccess: () => {
      toast.success("DSAR submitted");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to submit DSAR" }),
  });
  const updateDsarStatus = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DsarStatusUpdate }) => dsarService.updateStatus(id, data),
    onSuccess: () => {
      toast.success("Status updated");
      invalidate();
    },
    // e.g. 409 when reopening a completed/rejected request.
    onError: (err) => reportApiError(err, { fallback: "Failed to update status" }),
  });

  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<DsarDto | null>(null);
  const [detailTarget, setDetailTarget] = useState<DsarDto | null>(null);

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<SubmitForm>();
  const { hasPermission } = usePermissions();
  // Mirrors the API: status changes need MANAGE_COMPLIANCE (or an admin role).
  const canManage = hasPermission("MANAGE_COMPLIANCE");
  const { register: regU, handleSubmit: hsU, reset: resetU, setError: setErrorU, formState: { isSubmitting: subU, errors: errorsU } } = useForm<DsarUpdateForm>();
  // Assignee picker; an empty list (e.g. no VIEW_USERS) just leaves "Unassigned".
  const { data: users = [] } = useQuery({
    queryKey: qk.module("users").list(),
    queryFn: () => userService.getAll(),
    staleTime: 300_000,
    enabled: canManage,
  });
  const userName = (id?: string) => {
    if (!id) return "Unassigned";
    const u = users.find((x) => x.id === id);
    return u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || id : "Assigned";
  };

  const filtered = useMemo(() => {
    let list = requests;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          (r.requesterEmail || "").toLowerCase().includes(q) ||
          (r.notes || "").toLowerCase().includes(q) ||
          (r.requestType || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [requests, searchTerm]);

  const openCreate = () => {
    reset({ requestType: "ACCESS", requesterEmail: "", notes: "" });
    setIsSubmitOpen(true);
  };

  const onSubmit = async (data: SubmitForm) => {
    try {
      await submitDsar.mutateAsync({
        requesterEmail: data.requesterEmail.trim(),
        requestType: data.requestType,
        notes: data.notes?.trim() || undefined,
      });
      setIsSubmitOpen(false);
    } catch (err) {
      applyApiFieldErrors(err, setError);
    }
  };

  const openUpdate = (req: DsarDto) => {
    setUpdateTarget(req);
    resetU({ status: req.status as DsarStatus, responseSummary: req.responseSummary || "", assignedToUserId: req.assignedToUserId || "" });
  };

  const onUpdateStatus = async (form: DsarUpdateForm) => {
    if (!updateTarget?.id) return;
    try {
      await updateDsarStatus.mutateAsync({ id: updateTarget.id, data: buildDsarStatusUpdate(form, updateTarget) });
      setUpdateTarget(null);
    } catch (err) {
      // Toasted by the mutation; keep the dialog open with the fields marked.
      applyApiFieldErrors(err, setErrorU);
    }
  };

  const columns = useMemo<ColumnDef<DsarDto, unknown>[]>(
    () => [
      {
        id: "subject",
        header: "Data subject",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken">
              <User className="h-4 w-4 text-muted-fg" />
            </div>
            <div className="min-w-0 max-w-48">
              <p className="truncate font-semibold text-foreground">{row.original.requesterEmail || "—"}</p>
              {row.original.notes ? <p className="truncate text-xs text-faint-fg">{row.original.notes}</p> : null}
            </div>
          </div>
        ),
      },
      {
        id: "type",
        header: "Request type",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
            {REQUEST_TYPES.find((t) => t.value === row.original.requestType)?.label || row.original.requestType || "—"}
          </span>
        ),
      },
      {
        accessorKey: "submittedAt",
        header: "Submitted",
        cell: ({ row }) => <span className="text-muted-fg">{fmt(row.original.submittedAt)}</span>,
      },
      {
        id: "due",
        header: "Due date",
        enableSorting: false,
        cell: ({ row }) => {
          const days = daysLeft(row.original.dueAt);
          const urgent = days !== null && days <= 7 && row.original.status !== "COMPLETED" && row.original.status !== "REJECTED";
          if (!row.original.dueAt) return <span className="text-faint-fg">—</span>;
          return (
            <div>
              <p className={urgent ? "font-semibold text-danger" : "text-muted-fg"}>{fmt(row.original.dueAt)}</p>
              {urgent && days !== null ? (
                <p className="flex items-center gap-1 text-xs font-semibold text-danger">
                  <AlertTriangle className="h-3 w-3" />
                  {days <= 0 ? "Overdue" : `${days}d left`}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "PENDING"} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDetailTarget(row.original)}>
              View
            </Button>
            {canManage && !isDsarClosed(row.original.status) && (
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openUpdate(row.original)}>
                Update status
              </Button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage],
  );

  return (
    <ListPageTemplate
      title="Data subject access requests"
      subtitle={
        isLoading
          ? "Loading requests…"
          : `${total} ${statusFilter ? `${statusFilter.toLowerCase().replace("_", " ")} ` : ""}request${total === 1 ? "" : "s"}`
      }
      actions={
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New DSAR
        </Button>
      }
      toolbar={
        <>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
            <Input
              placeholder="Search by email, notes or request type…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setPage(0);
              setStatusFilter(e.target.value as DsarStatus | "");
            }}
            className="w-44"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-card border border-info/40 bg-info-soft p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <div>
            <p className="text-sm font-semibold text-foreground">Regulatory deadlines</p>
            <p className="mt-0.5 text-xs text-muted-fg">
              Each request gets a 30-day due date when it is recorded (GDPR). Ghana&apos;s DPA (Act 843) allows up to
              21 days, so treat Ghanaian requests as due sooner. Completed and rejected requests are final.
            </p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          pageInfo={{
            page,
            size: DSAR_PAGE_SIZE,
            totalElements: total,
            totalPages: Math.max(1, Math.ceil(total / DSAR_PAGE_SIZE)),
          }}
          onPageChange={setPage}
          emptyTitle="No DSAR requests"
          emptyDescription="Manage GDPR / Ghana DPA requests — access, erasure, rectification, and more."
          emptyAction={
            <Button size="sm" onClick={openCreate}>
              <FileText className="mr-1.5 h-4 w-4" /> New DSAR
            </Button>
          }
        />
      </div>

      <Modal
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        title="Submit data subject access request"
        description="Record a request from a data subject. An acknowledgement is emailed to them when email is enabled."
      >
        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="d-type">Request type <span className="text-danger">*</span></Label>
            <Select id="d-type" {...register("requestType", limitRules<SubmitForm, "requestType">(L.requestType, "Request type"))}>
              {REQUEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
            <FieldError error={errors.requestType} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-email">Data subject email <span className="text-danger">*</span></Label>
            <Input id="d-email" type="email" placeholder="email@example.com"
              {...limitInputProps(L.requesterEmail)}
              {...register("requesterEmail", limitRules<SubmitForm, "requesterEmail">(L.requesterEmail, "Email"))} />
            <FieldError error={errors.requesterEmail} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-notes">Request details</Label>
            <Textarea id="d-notes" placeholder="Who the subject is and what data they are asking about…" {...register("notes")} />
            <FieldError error={errors.notes} />
          </div>
          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsSubmitOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={submitDsar.isPending}>
              <FileText className="mr-1.5 h-4 w-4" /> Submit DSAR
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!updateTarget}
        onClose={() => setUpdateTarget(null)}
        title="Update DSAR status"
        description={updateTarget ? `${updateTarget.requesterEmail || "Request"} — ${updateTarget.requestType}` : ""}
      >
        <form onSubmit={hsU(onUpdateStatus)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="u-status">New status <span className="text-danger">*</span></Label>
            <Select id="u-status" {...regU("status", { required: "Status is required" })}>
              {updateTarget
                ? [updateTarget.status as DsarStatus, ...dsarNextStatuses(updateTarget.status)].map((st) => (
                    <option key={st} value={st}>{st.replace(/_/g, " ").toLowerCase()}</option>
                  ))
                : null}
            </Select>
            <FieldError error={errorsU.status} />
            <p className="text-xs text-faint-fg">Completing or rejecting a request is final.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-assignee">Assigned to</Label>
            <Select id="u-assignee" {...regU("assignedToUserId")}>
              <option value="">Unassigned</option>
              {updateTarget?.assignedToUserId && !users.some((u) => u.id === updateTarget.assignedToUserId) ? (
                <option value={updateTarget.assignedToUserId}>Current assignee</option>
              ) : null}
              {users.map((u) => (
                <option key={u.id} value={u.id}>{userName(u.id)}</option>
              ))}
            </Select>
            <FieldError error={errorsU.assignedToUserId} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-notes">Response summary</Label>
            <Textarea id="u-notes" placeholder="How the request was handled…" {...regU("responseSummary")} />
            <FieldError error={errorsU.responseSummary} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setUpdateTarget(null)}>Cancel</Button>
            <Button type="submit" isLoading={subU}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Update status
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="DSAR detail"
        description={detailTarget ? `ID: ${detailTarget.id?.slice(0, 16) || "—"}` : ""}
      >
        {detailTarget ? (
          <div className="space-y-3 text-sm">
            {[
              ["Data subject", detailTarget.requesterEmail || "—"],
              ["Request type", REQUEST_TYPES.find((t) => t.value === detailTarget.requestType)?.label || detailTarget.requestType || "—"],
              ["Status", detailTarget.status || "—"],
              ["Submitted", fmt(detailTarget.submittedAt)],
              ["Due date", fmt(detailTarget.dueAt)],
              ["Completed", fmt(detailTarget.completedAt)],
              ["Assigned to", userName(detailTarget.assignedToUserId)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-edge-subtle pb-2">
                <span className="text-muted-fg">{label}</span>
                <span className="max-w-[60%] text-right font-semibold text-foreground">{value}</span>
              </div>
            ))}
            {detailTarget.notes ? (
              <div>
                <p className="mb-1 text-muted-fg">Request details</p>
                <p className="rounded-control bg-surface-sunken p-2 text-xs text-foreground">{detailTarget.notes}</p>
              </div>
            ) : null}
            {detailTarget.responseSummary ? (
              <div>
                <p className="mb-1 text-muted-fg">Response summary</p>
                <p className="rounded-control bg-surface-sunken p-2 text-xs text-foreground">{detailTarget.responseSummary}</p>
              </div>
            ) : null}
            <Button className="mt-2 w-full" variant="outline" onClick={() => setDetailTarget(null)}>Close</Button>
          </div>
        ) : null}
      </Modal>
    </ListPageTemplate>
  );
}
