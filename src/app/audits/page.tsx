"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ClipboardCheck, Pencil, CheckSquare, ListChecks } from "lucide-react";
import { Audit, AuditStatus } from "@/types";
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
import { AuditCountSheet } from "@/features/audits/AuditCountSheet";
import {
  useAudits,
  useAuditMasterData,
  useCreateAudit,
  useUpdateAuditRemarks,
  useUpdateAuditStatus,
} from "@/features/audits/hooks";
import {
  auditEditChanges,
  auditQueryParams,
  auditScopeLabel,
  buildAuditPayload,
  auditProgressLabel,
  auditProgressOf,
  auditStatusOf,
  auditStatusOptions,
  EMPTY_AUDIT_FILTERS,
  isAuditFinal,
  nextAuditStatuses,
  type AuditFilters,
  type AuditForm,
} from "@/features/audits/workflow";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { usePermissions } from "@/contexts/PermissionContext";
import { applyApiFieldErrors, reportFormErrors } from "@/lib/api-validation";
import { formatLocalDate, toDateInputValue, todayLocal } from "@/lib/local-date";

export default function AuditsPage() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const { data: audits = [], isLoading, error, refetch, isFetching } = useAudits(auditQueryParams(filters));
  const master = useAuditMasterData();
  const createAudit = useCreateAudit();
  const updateStatus = useUpdateAuditStatus();
  const updateRemarks = useUpdateAuditRemarks();
  const { hasPermission } = usePermissions();
  // Mirrors the API: scheduling and status changes need CONDUCT_AUDIT.
  const canConduct = hasPermission("CONDUCT_AUDIT");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAudit, setEditingAudit] = useState<Audit | null>(null);
  const [countingAudit, setCountingAudit] = useState<Audit | null>(null);
  /**
   * The count sheet reads its progress off the audit record, which the server
   * rewrites as items are generated and verified. The row object captured when
   * the sheet was opened never changes, so the panel used to sit on "No count
   * sheet yet" for the whole session; re-read it from the list every render
   * (the sheet's mutations invalidate that query) and the sheet follows the
   * server. The snapshot is only the fallback for an audit the current filters
   * have since excluded.
   */
  const countingAuditLive = countingAudit
    ? audits.find((audit) => audit.id === countingAudit.id) ?? countingAudit
    : null;

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<AuditForm>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editingAudit
        ? {
            departmentId: editingAudit.departmentId || "",
            auditDate: toDateInputValue(editingAudit.auditDate),
            conductedById: editingAudit.conductedById || "",
            status: auditStatusOf(editingAudit),
            remarks: editingAudit.remarks || "",
          }
        : {
            departmentId: "",
            auditDate: todayLocal(),
            conductedById: "",
            status: AuditStatus.PLANNED,
            remarks: "",
          },
    );
  }, [isModalOpen, editingAudit, reset]);

  const lookups = useMemo(() => {
    const deptMap = new Map(master.departments.map((d) => [d.id, d.name]));
    const userMap = new Map(master.users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return {
      deptName: (id: string) => deptMap.get(id),
      userName: (id?: string) => userMap.get(id ?? "") ?? "—",
    };
  }, [master.departments, master.users]);

  const openCreate = () => {
    setEditingAudit(null);
    setIsModalOpen(true);
  };

  const onSubmit = async (data: AuditForm) => {
    try {
      if (editingAudit) {
        // Remarks save first (PATCH /audits/{id}): a status move may make the audit final.
        const changes = auditEditChanges(editingAudit, data);
        if (changes.remarks !== undefined) {
          await updateRemarks.mutateAsync({ id: editingAudit.id!, remarks: changes.remarks });
        }
        if (changes.status) {
          await updateStatus.mutateAsync({ id: editingAudit.id!, status: changes.status });
        }
      } else {
        await createAudit.mutateAsync(buildAuditPayload(data));
      }
      setIsModalOpen(false);
    } catch (err) {
      // Toasted by the mutation; keep the modal open with field errors marked.
      applyApiFieldErrors(err, setError);
    }
  };

  const columns = useMemo<ColumnDef<Audit, unknown>[]>(
    () => [
      {
        accessorKey: "auditDate",
        header: "Audit date",
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {formatLocalDate(row.original.auditDate)}
          </span>
        ),
      },
      {
        id: "scope",
        header: "Scope",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{auditScopeLabel(row.original, lookups.deptName)}</span>,
      },
      {
        id: "conductedBy",
        header: "Conducted by",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-fg">{row.original.conductedByName || lookups.userName(row.original.conductedById)}</span>
        ),
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
        cell: ({ row }) => <StatusBadge status={auditStatusOf(row.original)} />,
      },
      {
        id: "progress",
        header: "Count sheet",
        enableSorting: false,
        cell: ({ row }) => {
          const progress = auditProgressOf(row.original);
          return (
            <div className="min-w-32">
              <p className="text-xs text-muted-fg">{auditProgressLabel(progress)}</p>
              {progress.total > 0 ? (
                <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-surface-subtle">
                  <div className="h-full rounded-full bg-ok" style={{ width: `${progress.percent}%` }} />
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "verified",
        header: "Verified",
        enableSorting: false,
        // Backed by the API's allItemsVerified: the seal appears only when every
        // asset on the sheet has actually been sighted.
        cell: ({ row }) => {
          const progress = auditProgressOf(row.original);
          return (
            <AuditSeal
              verified={progress.allVerified}
              title={
                progress.allVerified
                  ? "Every asset on this audit was verified"
                  : auditProgressLabel(progress)
              }
            />
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        // Audits are immutable compliance records: status changes only, never deletion.
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Open count sheet"
              title="Count sheet"
              onClick={() => setCountingAudit(row.original)}
            >
              <ListChecks className="h-3.5 w-3.5" />
            </Button>
            {!canConduct || isAuditFinal(row.original.status) ? null : (
            <>
              {nextAuditStatuses(row.original.status).includes(AuditStatus.COMPLETED) && (
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
                aria-label="Edit audit status and remarks"
                onClick={() => {
                  setEditingAudit(row.original);
                  setIsModalOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookups, canConduct],
  );

  const openCount = audits.filter((a) => !isAuditFinal(a.status)).length;
  const statusOptions = auditStatusOptions(editingAudit);

  return (
    <ListPageTemplate
      title="Audits & inspections"
      subtitle={isLoading ? "Loading audits…" : `${audits.length} audits · ${openCount} open`}
      actions={
        canConduct ? (
          <Button onClick={openCreate}>
            <ClipboardCheck className="mr-2 h-4 w-4" /> Schedule audit
          </Button>
        ) : undefined
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="au-filter-status" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Status</label>
          <Select
            id="au-filter-status"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="h-8 w-44 text-xs"
          >
            <option value="">All statuses</option>
            {Object.values(AuditStatus).map((st) => (
              <option key={st} value={st}>{st.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="au-filter-dept" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">Department</label>
          <Select
            id="au-filter-dept"
            value={filters.departmentId}
            onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
            className="h-8 w-44 text-xs"
          >
            <option value="">All departments</option>
            {master.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="au-filter-from" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">From</label>
          <Input id="au-filter-from" type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="h-8 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="au-filter-to" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg">To</label>
          <Input id="au-filter-to" type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="h-8 text-xs" />
        </div>
        {Object.values(filters).some(Boolean) ? (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_AUDIT_FILTERS)}
            className="ea-focus mb-1.5 rounded-sm text-xs text-muted-fg underline underline-offset-2 hover:text-danger"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={audits}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        isRetrying={isFetching}
        errorWhat="your audits"
        emptyTitle="No audits yet"
        emptyDescription="Schedule physical inventory checks and record their outcome."
        emptyAction={
          canConduct ? (
            <Button size="sm" onClick={openCreate}>
              <ClipboardCheck className="mr-1.5 h-4 w-4" /> Schedule audit
            </Button>
          ) : undefined
        }
      />

      <Modal
        isOpen={!!countingAudit}
        onClose={() => setCountingAudit(null)}
        title={countingAuditLive ? `Count sheet · ${formatLocalDate(countingAuditLive.auditDate)}` : "Count sheet"}
        description="Every asset in this audit's scope, and what was found. Scan or type a tag to verify one."
      >
        <div className="max-h-[70vh] overflow-y-auto px-1">
          {countingAuditLive ? <AuditCountSheet audit={countingAuditLive} canConduct={canConduct} /> : null}
        </div>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAudit ? "Update audit" : "Schedule audit"}
        description={
          editingAudit
            ? "Change the status or remarks; the date, scope and auditor are fixed. Completed and cancelled audits are final."
            : "Plan a physical inventory verification."
        }
      >
        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="au-date">Audit date <span className="text-danger">*</span></Label>
              <Input id="au-date" type="date" disabled={!!editingAudit} {...register("auditDate", { required: true })} />
              <FieldError error={errors.auditDate} fallback="Audit date is required" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="au-status">Status</Label>
              <Select id="au-status" {...register("status")}>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
              <FieldError error={errors.status} />
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
                <option value="">Me</option>
                {/* Only active users can be named as the auditor (the API refuses others). */}
                {master.users
                  .filter((u) => u.id === editingAudit?.conductedById || !u.status || u.status === "ACTIVE")
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
              </Select>
              <FieldError error={errors.conductedById} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="au-remarks">Remarks</Label>
            <Textarea
              id="au-remarks"
              disabled={!!editingAudit && isAuditFinal(auditStatusOf(editingAudit))}
              placeholder="Scope notes, findings…"
              {...limitInputProps(FIELD_LIMITS.assetAudit.remarks)}
              {...register("remarks", limitRules<AuditForm, "remarks">(FIELD_LIMITS.assetAudit.remarks, "Remarks"))}
            />
            <FieldError error={errors.remarks} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createAudit.isPending || updateStatus.isPending || updateRemarks.isPending}>
              {editingAudit ? "Save changes" : "Schedule audit"}
            </Button>
          </div>
        </form>
      </Modal>
    </ListPageTemplate>
  );
}
