"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Calculator, Pencil, Trash2 } from "lucide-react";
import type { DepreciationPolicy, DepreciationPolicyDto } from "@/types";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";
import { useDepreciationPolicies, useOrgId, useSavePolicy, useDeletePolicy } from "@/features/depreciation/hooks";

const METHOD_LABEL: Record<string, string> = {
  STRAIGHT_LINE: "Straight line",
  DECLINING_BALANCE: "Declining balance",
  SUM_OF_YEARS_DIGITS: "Sum of years' digits",
};

export default function DepreciationPoliciesPage() {
  const { data: policies = [], isLoading } = useDepreciationPolicies();
  const orgId = useOrgId();
  const save = useSavePolicy();
  const remove = useDeletePolicy();
  const { confirm, ConfirmDialog } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<DepreciationPolicy | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DepreciationPolicyDto>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editingPolicy
        ? {
            name: editingPolicy.name,
            method: editingPolicy.method,
            usefulLifeMonths: editingPolicy.usefulLifeMonths || 36,
            salvageValuePercent: editingPolicy.salvageValuePercent || 0,
            description: editingPolicy.description || "",
            organisationId: editingPolicy.organisationId || orgId,
          }
        : {
            name: "",
            method: "STRAIGHT_LINE",
            usefulLifeMonths: 36,
            salvageValuePercent: 0,
            description: "",
            organisationId: orgId,
          },
    );
  }, [isModalOpen, editingPolicy, orgId, reset]);

  const openCreate = () => {
    setEditingPolicy(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (policy: DepreciationPolicy) => {
    if (
      !(await confirm({
        message: "Delete this policy? Assets using it may be affected.",
        variant: "danger",
      }))
    )
      return;
    remove.mutate(policy.id!);
  };

  const onSubmit = async (data: DepreciationPolicyDto) => {
    data.usefulLifeMonths = Number(data.usefulLifeMonths);
    data.salvageValuePercent = Number(data.salvageValuePercent);
    if (!data.organisationId) data.organisationId = orgId;

    (Object.keys(data) as (keyof DepreciationPolicyDto)[]).forEach((k) => {
      if (data[k] === "" && k !== "name" && k !== "method" && k !== "organisationId") {
        delete (data as unknown as Record<string, unknown>)[k];
      }
    });

    if (editingPolicy) {
      const patch = buildPatchPayload<DepreciationPolicyDto>(
        editingPolicy as unknown as Partial<DepreciationPolicyDto>,
        data,
      );
      if (Object.keys(patch).length === 0) {
        toast("No changes to update");
        return;
      }
      await save.mutateAsync({ id: editingPolicy.id!, data: patch });
    } else {
      await save.mutateAsync({ data });
    }
    setIsModalOpen(false);
  };

  const columns = useMemo<ColumnDef<DepreciationPolicy, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Policy",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-64">
            <p className="truncate font-semibold text-foreground">{row.original.name}</p>
            {row.original.description ? (
              <p className="truncate text-xs text-faint-fg" title={row.original.description}>
                {row.original.description}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "method",
        header: "Method",
        cell: ({ row }) => (
          <span className="text-muted-fg">{METHOD_LABEL[row.original.method ?? ""] ?? row.original.method ?? "—"}</span>
        ),
      },
      {
        accessorKey: "usefulLifeMonths",
        header: () => <span className="block text-right">Useful life</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {row.original.usefulLifeMonths ? `${row.original.usefulLifeMonths} mo` : "—"}
          </span>
        ),
      },
      {
        accessorKey: "salvageValuePercent",
        header: () => <span className="block text-right">Residual</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">
            {row.original.salvageValuePercent !== undefined ? `${row.original.salvageValuePercent}%` : "—"}
          </span>
        ),
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
              aria-label="Edit policy"
              onClick={() => {
                setEditingPolicy(row.original);
                setIsModalOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger"
              aria-label="Delete policy"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <ListPageTemplate
      title="Depreciation policies"
      subtitle={isLoading ? "Loading policies…" : `${policies.length} policies define how book value declines`}
      actions={
        <Button onClick={openCreate}>
          <Calculator className="mr-2 h-4 w-4" /> New policy
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={policies}
        isLoading={isLoading}
        emptyTitle="No depreciation policies"
        emptyDescription="Define how asset classes lose value — e.g. Standard IT hardware, straight line over 36 months."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Calculator className="mr-1.5 h-4 w-4" /> New policy
          </Button>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPolicy ? "Edit depreciation policy" : "New depreciation policy"}
        description="Reusable rules assets reference for depreciation schedules."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("organisationId")} />

          <div className="space-y-2">
            <Label htmlFor="dpp-name">Policy name <span className="text-danger">*</span></Label>
            <Input id="dpp-name" placeholder="e.g. Standard IT hardware (3 yrs)" {...register("name", { required: "Name is required" })} />
            {errors.name && <p className="text-sm text-danger">{errors.name.message as string}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dpp-method">Depreciation method <span className="text-danger">*</span></Label>
            <Select id="dpp-method" {...register("method", { required: "Method is required" })}>
              <option value="STRAIGHT_LINE">Straight line</option>
              <option value="DECLINING_BALANCE">Declining balance</option>
              <option value="SUM_OF_YEARS_DIGITS">Sum of years&apos; digits</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dpp-life">Useful life (months)</Label>
              <Input id="dpp-life" type="number" min="1" {...register("usefulLifeMonths")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dpp-salvage">Residual value (%)</Label>
              <Input id="dpp-salvage" type="number" step="0.01" min="0" max="100" {...register("salvageValuePercent")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dpp-description">Description</Label>
            <Input id="dpp-description" placeholder="Applies to laptops and mobile phones…" {...register("description")} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={save.isPending}>
              {editingPolicy ? "Save changes" : "Create policy"}
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
