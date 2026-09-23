"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Calculator, Pencil, Trash2 } from "lucide-react";
import type { DepreciationPolicy } from "@/types";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useConfirm } from "@/hooks/useConfirm";
import { useDepreciationPolicies, useSavePolicy, useDeletePolicy } from "@/features/depreciation/hooks";
import {
  DEPRECIATION_METHODS,
  METHOD_LABEL,
  UNITS_OF_PRODUCTION_HINT,
  buildDepreciationPolicyPayload,
  depreciationPolicyFormValues,
  type DepreciationPolicyForm,
} from "@/features/depreciation/payload";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { FieldError } from "@/components/ui/field-error";
import { reportApiError, reportFormErrors } from "@/lib/api-validation";

export default function DepreciationPoliciesPage() {
  const { data: policies = [], isLoading, error, refetch, isFetching } = useDepreciationPolicies();
  const save = useSavePolicy();
  const remove = useDeletePolicy();
  const { confirm, ConfirmDialog } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<DepreciationPolicy | null>(null);

  const { register, handleSubmit, reset, watch, setError, formState: { errors } } = useForm<DepreciationPolicyForm>();
  const selectedMethod = watch("method");

  useEffect(() => {
    if (!isModalOpen) return;
    reset(depreciationPolicyFormValues(editingPolicy));
  }, [isModalOpen, editingPolicy, reset]);

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

  const onSubmit = async (data: DepreciationPolicyForm) => {
    try {
      await save.mutateAsync({ id: editingPolicy?.id, data: buildDepreciationPolicyPayload(data) });
      setIsModalOpen(false);
    } catch (error) {
      reportApiError(error, { fallback: "Failed to save depreciation policy", setError });
    }
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
            {row.original.salvageValuePercent != null ? `${row.original.salvageValuePercent}%` : "—"}
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
        error={error}
        onRetry={refetch}
        isRetrying={isFetching}
        errorWhat="your depreciation policies"
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
        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dpp-name">Policy name <span className="text-danger">*</span></Label>
            <Input
              id="dpp-name"
              placeholder="e.g. Standard IT hardware (3 yrs)"
              {...limitInputProps(FIELD_LIMITS.depreciationPolicy.name)}
              {...register("name", limitRules<DepreciationPolicyForm, "name">(FIELD_LIMITS.depreciationPolicy.name, "Name"))}
            />
            <FieldError error={errors.name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dpp-method">Depreciation method <span className="text-danger">*</span></Label>
            <Select id="dpp-method" {...register("method", { required: "Method is required" })}>
              {DEPRECIATION_METHODS.map((m) => (
                <option key={m} value={m}>{METHOD_LABEL[m]}</option>
              ))}
            </Select>
            {selectedMethod === "UNITS_OF_PRODUCTION" ? (
              <p className="text-xs text-muted-fg">{UNITS_OF_PRODUCTION_HINT}</p>
            ) : null}
            <FieldError error={errors.method} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dpp-life">Useful life (months)</Label>
              <Input
                id="dpp-life"
                type="number"
                {...limitInputProps(FIELD_LIMITS.depreciationPolicy.usefulLifeMonths)}
                {...register("usefulLifeMonths", {
                  ...limitRules<DepreciationPolicyForm, "usefulLifeMonths">(FIELD_LIMITS.depreciationPolicy.usefulLifeMonths, "Useful life"),
                  validate: (v) => v === "" || v == null || Number.isInteger(Number(v)) || "Useful life must be a whole number of months",
                })}
              />
              <FieldError error={errors.usefulLifeMonths} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dpp-salvage">Residual value (%)</Label>
              <Input
                id="dpp-salvage"
                type="number"
                {...limitInputProps(FIELD_LIMITS.depreciationPolicy.salvageValuePercent)}
                {...register(
                  "salvageValuePercent",
                  limitRules<DepreciationPolicyForm, "salvageValuePercent">(FIELD_LIMITS.depreciationPolicy.salvageValuePercent, "Residual value"),
                )}
              />
              <FieldError error={errors.salvageValuePercent} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dpp-description">Description</Label>
            <Input id="dpp-description" placeholder="Applies to laptops and mobile phones…" {...register("description")} />
            <FieldError error={errors.description} />
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
