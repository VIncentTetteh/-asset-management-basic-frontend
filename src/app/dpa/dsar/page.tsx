"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Search, Clock, RefreshCw, CheckCircle2, AlertTriangle, User } from "lucide-react";
import { dsarService, type DsarDto, type DsarType, type DsarStatus, type DsarStatusUpdate } from "@/services/dsarService";
import { qk } from "@/lib/queryClient";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";

const REQUEST_TYPES: { value: DsarType; label: string }[] = [
  { value: "ACCESS", label: "Access" },
  { value: "ERASURE", label: "Erasure (right to be forgotten)" },
  { value: "RECTIFICATION", label: "Rectification" },
  { value: "PORTABILITY", label: "Portability" },
  { value: "RESTRICTION", label: "Restriction" },
  { value: "OBJECTION", label: "Objection" },
];

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const daysLeft = (d?: string) => (d ? Math.round((new Date(d).getTime() - Date.now()) / 86400000) : null);

type SubmitForm = Pick<DsarDto, "requestType" | "subjectEmail" | "subjectName" | "subjectId" | "description">;

export default function DsarPage() {
  const queryClient = useQueryClient();
  const dsarKey = qk.module("dsar");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: dsarKey.list(),
    queryFn: () => dsarService.listAll(),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: dsarKey.all });

  const submitDsar = useMutation({
    mutationFn: (data: SubmitForm) => dsarService.submit(data),
    onSuccess: () => {
      toast.success("DSAR submitted");
      invalidate();
    },
    onError: () => toast.error("Failed to submit DSAR"),
  });
  const updateDsarStatus = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DsarStatusUpdate }) => dsarService.updateStatus(id, data),
    onSuccess: () => {
      toast.success("Status updated");
      invalidate();
    },
    onError: () => toast.error("Failed to update status"),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DsarStatus | "">("");
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<DsarDto | null>(null);
  const [detailTarget, setDetailTarget] = useState<DsarDto | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SubmitForm>();
  const { register: regU, handleSubmit: hsU, reset: resetU, formState: { isSubmitting: subU } } = useForm<DsarStatusUpdate>();

  const filtered = useMemo(() => {
    let list = requests;
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          (r.subjectEmail || "").toLowerCase().includes(q) ||
          (r.subjectName || "").toLowerCase().includes(q) ||
          (r.requestType || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [requests, statusFilter, searchTerm]);

  const pending = requests.filter((r) => r.status === "PENDING").length;
  const inProgress = requests.filter((r) => r.status === "IN_PROGRESS").length;
  const completed = requests.filter((r) => r.status === "COMPLETED").length;

  const openCreate = () => {
    reset({ requestType: "ACCESS" });
    setIsSubmitOpen(true);
  };

  const onSubmit = async (data: SubmitForm) => {
    await submitDsar.mutateAsync(data);
    setIsSubmitOpen(false);
  };

  const openUpdate = (req: DsarDto) => {
    setUpdateTarget(req);
    resetU({ status: req.status as DsarStatus, responseNotes: req.responseNotes || "" });
  };

  const onUpdateStatus = async (data: DsarStatusUpdate) => {
    if (!updateTarget?.id) return;
    await updateDsarStatus.mutateAsync({ id: updateTarget.id, data });
    setUpdateTarget(null);
  };

  const columns = useMemo<ColumnDef<DsarDto, unknown>[]>(
    () => [
      {
        id: "subject",
        header: "Subject",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken">
              <User className="h-4 w-4 text-muted-fg" />
            </div>
            <div className="min-w-0 max-w-48">
              <p className="truncate font-semibold text-foreground">{row.original.subjectName || "—"}</p>
              <p className="truncate text-xs text-faint-fg">{row.original.subjectEmail || row.original.subjectId || "—"}</p>
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
        accessorKey: "createdAt",
        header: "Submitted",
        cell: ({ row }) => <span className="text-muted-fg">{fmt(row.original.createdAt)}</span>,
      },
      {
        id: "due",
        header: "Due date",
        enableSorting: false,
        cell: ({ row }) => {
          const days = daysLeft(row.original.dueDate);
          const urgent = days !== null && days <= 7 && row.original.status !== "COMPLETED" && row.original.status !== "REJECTED";
          if (!row.original.dueDate) return <span className="text-faint-fg">—</span>;
          return (
            <div>
              <p className={urgent ? "font-semibold text-danger" : "text-muted-fg"}>{fmt(row.original.dueDate)}</p>
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
            {row.original.status !== "COMPLETED" && row.original.status !== "CANCELLED" && (
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openUpdate(row.original)}>
                Update status
              </Button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <ListPageTemplate
      title="Data subject access requests"
      subtitle={
        isLoading
          ? "Loading requests…"
          : `${requests.length} requests · ${pending} pending · ${inProgress} in progress · ${completed} completed`
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
              placeholder="Search by subject or request type…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DsarStatus | "")} className="w-44">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
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
              GDPR requires responses within 30 days. Ghana&apos;s DPA (Act 843) allows up to 21 days. Mark requests
              as in progress immediately upon receipt and track due dates carefully.
            </p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
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
        description="Record a new request from a data subject."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="d-type">Request type <span className="text-danger">*</span></Label>
            <Select id="d-type" {...register("requestType", { required: "Request type is required" })}>
              {REQUEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
            {errors.requestType && <p className="text-sm text-danger">{errors.requestType.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="d-name">Subject name</Label>
              <Input id="d-name" placeholder="Full name…" {...register("subjectName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-email">Subject email</Label>
              <Input id="d-email" type="email" placeholder="email@example.com" {...register("subjectEmail")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-sid">Subject ID <span className="text-danger">*</span></Label>
            <Input id="d-sid" placeholder="Internal user/customer ID" {...register("subjectId", { required: "Subject ID is required" })} />
            {errors.subjectId && <p className="text-sm text-danger">{errors.subjectId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-desc">Description / request details</Label>
            <Textarea id="d-desc" placeholder="What specific data is the subject requesting access to or deletion of?" {...register("description")} />
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
        description={updateTarget ? `${updateTarget.subjectName || updateTarget.subjectEmail || "Request"} — ${updateTarget.requestType}` : ""}
      >
        <form onSubmit={hsU(onUpdateStatus)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="u-status">New status <span className="text-danger">*</span></Label>
            <Select id="u-status" {...regU("status", { required: "Status is required" })}>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-notes">Response notes</Label>
            <Textarea id="u-notes" placeholder="Internal notes on how the request was handled…" {...regU("responseNotes")} />
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
              ["Subject", detailTarget.subjectName || "—"],
              ["Email", detailTarget.subjectEmail || "—"],
              ["Subject ID", detailTarget.subjectId || "—"],
              ["Request type", REQUEST_TYPES.find((t) => t.value === detailTarget.requestType)?.label || detailTarget.requestType || "—"],
              ["Status", detailTarget.status || "—"],
              ["Submitted", fmt(detailTarget.createdAt)],
              ["Due date", fmt(detailTarget.dueDate)],
              ["Completed", fmt(detailTarget.completedAt)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-edge-subtle pb-2">
                <span className="text-muted-fg">{label}</span>
                <span className="max-w-[60%] text-right font-semibold text-foreground">{value}</span>
              </div>
            ))}
            {detailTarget.description ? (
              <div>
                <p className="mb-1 text-muted-fg">Description</p>
                <p className="rounded-control bg-surface-sunken p-2 text-xs text-foreground">{detailTarget.description}</p>
              </div>
            ) : null}
            {detailTarget.responseNotes ? (
              <div>
                <p className="mb-1 text-muted-fg">Response notes</p>
                <p className="rounded-control bg-surface-sunken p-2 text-xs text-foreground">{detailTarget.responseNotes}</p>
              </div>
            ) : null}
            <Button className="mt-2 w-full" variant="outline" onClick={() => setDetailTarget(null)}>Close</Button>
          </div>
        ) : null}
      </Modal>
    </ListPageTemplate>
  );
}
