"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ClipboardCheck, Pencil, Trash2, CheckSquare } from "lucide-react";
import { Audit, AssetAuditDto, AuditStatus } from "@/types";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { AuditSeal } from "@/components/ui/audit-seal";
import { useConfirm } from "@/hooks/useConfirm";
import {
  useAudits,
  useAuditMasterData,
  useCreateAudit,
  useUpdateAuditStatus,
  useDeleteAudit,
} from "@/features/audits/hooks";

export default function AuditsPage() {
  const { data: audits = [], isLoading } = useAudits();
  const master = useAuditMasterData();
  const createAudit = useCreateAudit();
  const updateStatus = useUpdateAuditStatus();
  const remove = useDeleteAudit();
  const { confirm, ConfirmDialog } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAudit, setEditingAudit] = useState<Audit | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AssetAuditDto>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editingAudit
        ? {
            organisationId: editingAudit.organisationId || "",
            departmentId: editingAudit.departmentId || "",
            auditDate: editingAudit.auditDate ? new Date(editingAudit.auditDate).toISOString().split("T")[0] : "",
            conductedById: editingAudit.conductedById || "",
            status: (editingAudit.status as AuditStatus) || AuditStatus.PLANNED,
            remarks: editingAudit.remarks || "",
          }
        : {
            organisationId: master.orgId,
            departmentId: "",
            auditDate: new Date().toISOString().split("T")[0],
            conductedById: "",
            status: AuditStatus.PLANNED,
            remarks: "",
          },
    );
  }, [isModalOpen, editingAudit, master.orgId, reset]);

  const lookups = useMemo(() => {
    const deptMap = new Map(master.departments.map((d) => [d.id, d.name]));
    const userMap = new Map(master.users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return {
      deptName: (id?: string) => deptMap.get(id ?? "") ?? "Whole organisation",
      userName: (id?: string) => userMap.get(id ?? "") ?? "—",
    };
  }, [master.departments, master.users]);

  const openCreate = () => {
    setEditingAudit(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (audit: Audit) => {
    if (!(await confirm({ message: "Delete this audit record?", variant: "danger" }))) return;
    remove.mutate(audit.id!);
  };

  const onSubmit = async (data: AssetAuditDto) => {
    if (editingAudit) {
      // The API only supports PATCHing status on existing audits.
      await updateStatus.mutateAsync({ id: editingAudit.id!, status: data.status as AuditStatus });
    } else {
      if (!data.organisationId) data.organisationId = master.orgId;
      await createAudit.mutateAsync(data);
    }
    setIsModalOpen(false);
  };

  const columns = useMemo<ColumnDef<Audit, unknown>[]>(
    () => [
      {
        accessorKey: "auditDate",
        header: "Audit date",
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {row.original.auditDate ? new Date(row.original.auditDate).toLocaleDateString() : "—"}
          </span>
        ),
      },
      {
        id: "scope",
        header: "Scope",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{lookups.deptName(row.original.departmentId)}</span>,
      },
      {
        id: "conductedBy",
        header: "Conducted by",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{lookups.userName(row.original.conductedById)}</span>,
      },
      {
        id: "remarks",
        header: "Remarks",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-64 truncate text-muted-fg" title={row.original.remarks}>
            {row.original.remarks || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "PLANNED"} />,
      },
      {
        id: "verified",
        header: "Verified",
        enableSorting: false,
        cell: ({ row }) => <AuditSeal verified={row.original.status === AuditStatus.COMPLETED} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            {row.original.status !== AuditStatus.COMPLETED && row.original.status !== AuditStatus.CANCELLED && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-brand"
                onClick={() => updateStatus.mutate({ id: row.original.id!, status: AuditStatus.COMPLETED })}
              >
                <CheckSquare className="h-3.5 w-3.5" /> Complete
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Edit audit"
              onClick={() => {
                setEditingAudit(row.original);
                setIsModalOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger"
              aria-label="Delete audit"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookups],
  );

  const openCount = audits.filter(
    (a) => a.status !== AuditStatus.COMPLETED && a.status !== AuditStatus.CANCELLED,
  ).length;

  return (
    <ListPageTemplate
      title="Audits & inspections"
      subtitle={isLoading ? "Loading audits…" : `${audits.length} audits · ${openCount} open`}
      actions={
        <Button onClick={openCreate}>
          <ClipboardCheck className="mr-2 h-4 w-4" /> Schedule audit
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={audits}
        isLoading={isLoading}
        emptyTitle="No audits yet"
        emptyDescription="Schedule physical inventory checks; completed audits earn the verification seal."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <ClipboardCheck className="mr-1.5 h-4 w-4" /> Schedule audit
          </Button>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAudit ? "Update audit status" : "Schedule audit"}
        description={
          editingAudit
            ? "Existing audits only support status changes."
            : "Plan a physical inventory verification."
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="au-date">Audit date <span className="text-danger">*</span></Label>
              <Input id="au-date" type="date" disabled={!!editingAudit} {...register("auditDate", { required: true })} />
              {errors.auditDate && <p className="text-sm text-danger">Audit date is required</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="au-status">Status</Label>
              <Select id="au-status" {...register("status")}>
                {Object.values(AuditStatus).map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="au-dept">Department scope</Label>
              <Select id="au-dept" disabled={!!editingAudit} {...register("departmentId")}>
                <option value="">Whole organisation</option>
                {master.departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="au-user">Conducted by</Label>
              <Select id="au-user" disabled={!!editingAudit} {...register("conductedById")}>
                <option value="">Select auditor</option>
                {master.users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="au-remarks">Remarks</Label>
            <Textarea id="au-remarks" disabled={!!editingAudit} placeholder="Scope notes, findings…" {...register("remarks")} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createAudit.isPending || updateStatus.isPending}>
              {editingAudit ? "Update status" : "Schedule audit"}
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
