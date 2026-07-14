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
import { StatusBadge } from "@/components/ui/status-badge";
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function DepartmentsPage() {
  const { format } = useCurrency();
  const { confirm, ConfirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const departmentsKey = qk.module("departments");

  const { data: departments = [], isLoading } = useQuery({
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
    onError: () => toast.error("Failed to delete department"),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DepartmentDto>();

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
          }
        : { name: "", departmentCode: "", costCenterCode: "", budgetLimit: undefined, status: "ACTIVE" },
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

    const payload: DepartmentDto = { ...data };
    delete payload.description;
    if (!payload.departmentCode) delete payload.departmentCode;
    if (!payload.costCenterCode) delete payload.costCenterCode;
    if (payload.budgetLimit) payload.budgetLimit = Number(payload.budgetLimit);

    try {
      if (editingDept) {
        const prevForPatch: Partial<DepartmentDto> = { ...(editingDept as unknown as Partial<DepartmentDto>) };
        delete prevForPatch.description;
        const patch = buildPatchPayload<DepartmentDto>(prevForPatch, payload);
        if (Object.keys(patch).length === 0) {
          toast("No changes to update");
          return;
        }
        await departmentService.update(editingDept.id!, patch);
        toast.success("Department updated");
      } else {
        await departmentService.create(payload);
        toast.success("Department created");
      }
      setIsModalOpen(false);
      invalidate();
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toast.error("A department with that name, code, or cost center already exists.");
      } else {
        toast.error("Failed to save department");
      }
      console.error(error);
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
        header: () => <span className="block text-right">Budget limit</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {row.original.budgetLimit ? format(row.original.budgetLimit, "GHS") : "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "ACTIVE"} />,
      },
      {
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
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [format],
  );

  return (
    <ListPageTemplate
      title="Departments"
      subtitle={isLoading ? "Loading departments…" : `${departments.length} departments and cost centers`}
      actions={
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New department
        </Button>
      }
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
        emptyTitle="No departments yet"
        emptyDescription="Structure your organisation into departments with codes and budget limits."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Layers className="mr-1.5 h-4 w-4" /> New department
          </Button>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDept ? "Edit department" : "New department"}
        description="Departments group assets, people, and budgets."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Name <span className="text-danger">*</span></Label>
            <Input id="dept-name" placeholder="IT Operations" {...register("name", { required: "Name is required" })} />
            {errors.name && <p className="text-sm text-danger">{errors.name.message as string}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dept-code">Department code</Label>
              <Input id="dept-code" placeholder="IT-OPS" className="data-mono" {...register("departmentCode")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-cc">Cost center</Label>
              <Input id="dept-cc" placeholder="CC-1001" className="data-mono" {...register("costCenterCode")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dept-budget">Budget limit</Label>
              <Input id="dept-budget" type="number" step="0.01" min="0" {...register("budgetLimit")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-status">Status</Label>
              <Select id="dept-status" {...register("status")}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
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
