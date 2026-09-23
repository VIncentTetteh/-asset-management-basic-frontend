"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Layers, Search } from "lucide-react";
import type { Department, DepartmentDto } from "@/types";
import { qk } from "@/lib/queryClient";
import { departmentService } from "@/services/departmentService";
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
import { buildDepartmentPayload, DEPARTMENT_STATUSES } from "@/features/departments/departmentPayload";
import { StatusBadge } from "@/components/ui/status-badge";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import { usePermissions } from "@/contexts/PermissionContext";
import Link from "next/link";
import { reportApiError, reportFormErrors } from "@/lib/api-validation";
import { ImportButton } from "@/features/imports/ImportButton";

const L = FIELD_LIMITS.department;

export default function DepartmentsPage() {
  const { format, baseCurrency } = useCurrency();
  const { hasPermission } = usePermissions();
  const canManageDepartments = hasPermission("MANAGE_DEPARTMENTS")
    || hasPermission("MANAGE_ORGANIZATION_SETTINGS");
  const { confirm, ConfirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const departmentsKey = qk.module("departments");

  const { data: departments = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: departmentsKey.list(),
    queryFn: () => departmentService.getAll(),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: departmentsKey.all });

  const deleteDept = useMutation({
    mutationFn: (id: string) => departmentService.delete(id),
    onSuccess: () => {
      toast.success("Department deleted");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to delete department" }),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<DepartmentDto>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editingDept
        ? {
            name: editingDept.name,
            departmentCode: editingDept.departmentCode || "",
            costCenterCode: editingDept.costCenterCode || "",
            budgetLimit: editingDept.budgetLimit,
            status: editingDept.status || "ACTIVE",
            description: editingDept.description || "",
          }
        : { name: "", departmentCode: "", costCenterCode: "", budgetLimit: undefined, status: "ACTIVE", description: "" },
    );
  }, [isModalOpen, editingDept, reset]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.departmentCode?.toLowerCase().includes(q) ||
        d.costCenterCode?.toLowerCase().includes(q),
    );
  }, [departments, searchTerm]);

  const openCreate = () => {
    setEditingDept(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (dept: Department) => {
    if (
      !(await confirm({
        message: `Delete "${dept.name}"? Assets and users assigned to it keep their history.`,
        variant: "danger",
      }))
    )
      return;
    deleteDept.mutate(dept.id!);
  };

  const onSubmit = async (data: DepartmentDto) => {
    const others = departments.filter((dept) => dept.id !== editingDept?.id);

    if (others.find((dept) => dept.name.toLowerCase() === data.name.toLowerCase())) {
      toast.error(`A department named "${data.name}" already exists.`);
      return;
    }
    const duplicateCode =
      data.departmentCode &&
      others.find((dept) => dept.departmentCode?.toLowerCase() === data.departmentCode!.toLowerCase());
    if (duplicateCode) {
      toast.error(`Department code "${data.departmentCode}" is already used by "${duplicateCode.name}".`);
      return;
    }
    const duplicateCostCenter =
      data.costCenterCode &&
      others.find((dept) => dept.costCenterCode?.toLowerCase() === data.costCenterCode!.toLowerCase());
    if (duplicateCostCenter) {
      toast.error(`Cost center "${data.costCenterCode}" is already used by "${duplicateCostCenter.name}".`);
      return;
    }

    const payload = buildDepartmentPayload(data, editingDept);
    try {
      if (editingDept) {
        if (Object.keys(payload).length === 0) {
          toast("No changes to update");
          return;
        }
        await departmentService.update(editingDept.id!, payload);
        toast.success("Department updated");
      } else {
        await departmentService.create(payload as DepartmentDto);
        toast.success("Department created");
      }
      setIsModalOpen(false);
      invalidate();
    } catch (error) {
      reportApiError(error, { fallback: "Failed to save department", setError });
    }
  };

  const columns = useMemo<ColumnDef<Department, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Department",
        cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.name}</span>,
      },
      {
        accessorKey: "departmentCode",
        header: "Code",
        cell: ({ row }) =>
          row.original.departmentCode ? (
            <span className="data-mono text-xs">{row.original.departmentCode}</span>
          ) : (
            <span className="text-faint-fg">—</span>
          ),
      },
      {
        accessorKey: "costCenterCode",
        header: "Cost center",
        cell: ({ row }) =>
          row.original.costCenterCode ? (
            <span className="data-mono text-xs">{row.original.costCenterCode}</span>
          ) : (
            <span className="text-faint-fg">—</span>
          ),
      },
      {
        accessorKey: "budgetLimit",
        header: () => (
          <span className="block text-right" title="An informational planning cap, not a budget. Spending is tracked and enforced under Budgets.">
            Planning cap
          </span>
        ),
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {row.original.budgetLimit ? format(row.original.budgetLimit, baseCurrency) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "ACTIVE"} />,
      },
      ...(canManageDepartments ? [{
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Edit department"
              onClick={() => {
                setEditingDept(row.original);
                setIsModalOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger"
              aria-label="Delete department"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      } as ColumnDef<Department, unknown>] : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [format, canManageDepartments, baseCurrency],
  );

  return (
    <ListPageTemplate
      title="Departments"
      subtitle={isLoading ? "Loading departments…" : `${departments.length} departments and cost centers`}
      actions={canManageDepartments ? (
        <>
          <ImportButton type="departments" />
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New department
          </Button>
        </>
      ) : undefined}
      toolbar={
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
          <Input
            placeholder="Search name, code, or cost center…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      }
    >
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        isRetrying={isFetching}
        errorWhat="your departments"
        emptyTitle="No departments yet"
        emptyDescription="Structure your organisation into departments with codes and cost centers."
        emptyAction={canManageDepartments ? (
          <Button size="sm" onClick={openCreate}>
            <Layers className="mr-1.5 h-4 w-4" /> New department
          </Button>
        ) : undefined}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDept ? "Edit department" : "New department"}
        description="Departments group assets, people, and budgets."
      >
        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Name <span className="text-danger">*</span></Label>
            <Input
              id="dept-name"
              placeholder="IT Operations"
              {...limitInputProps(L.name)}
              {...register("name", limitRules<DepartmentDto, "name">(L.name, "Name"))}
            />
            <FieldError error={errors.name} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dept-code">Department code</Label>
              <Input
                id="dept-code"
                placeholder="IT-OPS"
                className="data-mono"
                {...limitInputProps(L.departmentCode)}
                {...register("departmentCode", limitRules<DepartmentDto, "departmentCode">(L.departmentCode, "Department code"))}
              />
              <FieldError error={errors.departmentCode} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-cc">Cost center</Label>
              <Input
                id="dept-cc"
                placeholder="CC-1001"
                className="data-mono"
                {...limitInputProps(L.costCenterCode)}
                {...register("costCenterCode", limitRules<DepartmentDto, "costCenterCode">(L.costCenterCode, "Cost center"))}
              />
              <FieldError error={errors.costCenterCode} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dept-budget">Planning cap ({baseCurrency})</Label>
              <Input
                id="dept-budget"
                type="number"
                {...limitInputProps(L.budgetLimit)}
                {...register("budgetLimit", limitRules<DepartmentDto, "budgetLimit">(L.budgetLimit, "Planning cap"))}
              />
              <FieldError error={errors.budgetLimit} />
              <p className="text-xs text-faint-fg">
                Informational only — nothing is checked against it. To control spending, create a department budget
                under <Link href="/budgets" className="text-brand underline">Budgets</Link>.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-status">Status</Label>
              <Select id="dept-status" {...register("status")}>
                {DEPARTMENT_STATUSES.map((st) => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </Select>
              <FieldError error={errors.status} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dept-description">Description</Label>
            <Textarea id="dept-description" rows={3} {...register("description")} />
            <FieldError error={errors.description} />
          </div>

          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingDept ? "Save changes" : "Create department"}
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
