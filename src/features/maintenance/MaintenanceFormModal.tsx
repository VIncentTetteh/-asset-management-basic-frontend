"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { MaintenanceRecord, MaintenanceType, Asset, Supplier } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSaveMaintenance } from "@/features/maintenance/hooks";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencyOptions } from "@/components/currency/CurrencyOptions";
import { applyApiFieldErrors, reportFormErrors } from "@/lib/api-validation";
import {
  buildMaintenancePayload,
  defaultMaintenanceCurrency,
  maintainableAssets,
  type MaintenanceForm,
} from "@/features/maintenance/payload";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { todayLocal } from "@/lib/local-date";

export function MaintenanceFormModal({
  isOpen,
  onClose,
  editingRecord,
  assets,
  suppliers,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingRecord: MaintenanceRecord | null;
  assets: Asset[];
  suppliers: Supplier[];
}) {
  const { register, handleSubmit, reset, setError, setValue, watch, getFieldState, formState: { errors } } =
    useForm<MaintenanceForm>();
  const save = useSaveMaintenance();
  const { baseCurrency } = useCurrency();
  // React Compiler intentionally skips React Hook Form's subscription API.
  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedAssetId = watch("assetId");

  // A new record's cost is in the asset's currency unless the user picks another.
  useEffect(() => {
    if (!isOpen || editingRecord || !selectedAssetId) return;
    if (getFieldState("currency").isDirty) return;
    const asset = assets.find((a) => a.id === selectedAssetId);
    setValue("currency", defaultMaintenanceCurrency(asset, baseCurrency));
  }, [isOpen, editingRecord, selectedAssetId, assets, baseCurrency, getFieldState, setValue]);

  useEffect(() => {
    if (!isOpen) return;
    reset(
      editingRecord
        ? {
            assetId: editingRecord.assetId,
            scheduledDate: editingRecord.scheduledDate ? editingRecord.scheduledDate.split("T")[0] : "",
            performedDate: editingRecord.performedDate ? editingRecord.performedDate.split("T")[0] : "",
            nextDueDate: editingRecord.nextDueDate ? editingRecord.nextDueDate.split("T")[0] : "",
            description: editingRecord.description || "",
            maintenanceType: editingRecord.maintenanceType,
            cost: editingRecord.cost ?? "",
            currency: editingRecord.currency || baseCurrency,
            vendorId: editingRecord.vendorId || "",
            status: editingRecord.status,
          }
        : {
            assetId: "",
            scheduledDate: todayLocal(),
            performedDate: "",
            nextDueDate: "",
            description: "",
            maintenanceType: MaintenanceType.PREVENTIVE,
            cost: "",
            currency: baseCurrency,
            vendorId: "",
            status: "SCHEDULED",
          },
    );
  }, [isOpen, editingRecord, reset, baseCurrency]);

  const onSubmit = async (data: MaintenanceForm) => {
    const payload = buildMaintenancePayload(data);
    try {
      await save.mutateAsync(editingRecord ? { id: editingRecord.id!, data: payload } : { data: payload });
      onClose();
    } catch (err) {
      // The mutation toasted; keep the modal open with any field errors marked.
      applyApiFieldErrors(err, setError);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingRecord ? "Edit maintenance log" : "Schedule maintenance"}
      description={editingRecord ? "Update the maintenance details." : "Create a maintenance or repair ticket for an asset."}
    >
      <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
        <div className="space-y-2">
          <Label htmlFor="mt-assetId">Target asset <span className="text-danger">*</span></Label>
          <Select id="mt-assetId" {...register("assetId", { required: "Asset is required" })} disabled={!!editingRecord}>
            <option value="">Select asset</option>
            {maintainableAssets(assets, editingRecord?.assetId).map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "no tag"})</option>
            ))}
          </Select>
          <FieldError error={errors.assetId} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mt-type">Maintenance type</Label>
            <Select id="mt-type" {...register("maintenanceType")}>
              {Object.values(MaintenanceType).map((t) => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </Select>
            <FieldError error={errors.maintenanceType} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mt-status">Status</Label>
            <Select id="mt-status" {...register("status")}>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <FieldError error={errors.status} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mt-description">Task description / issue</Label>
          <Textarea id="mt-description" placeholder="Replace battery and clean fans…" {...register("description")} />
          <FieldError error={errors.description} />
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-edge-subtle pt-4">
          <div className="space-y-2">
            <Label htmlFor="mt-scheduled">Scheduled date <span className="text-danger">*</span></Label>
            <Input id="mt-scheduled" type="date" {...register("scheduledDate", { required: "Scheduled date is required" })} />
            <FieldError error={errors.scheduledDate} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mt-currency">Currency</Label>
            <Select id="mt-currency" {...register("currency")}>
              <CurrencyOptions current={editingRecord?.currency} />
            </Select>
            <FieldError error={errors.currency} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mt-cost">Estimated / actual cost</Label>
          <Input
            id="mt-cost"
            type="number"
            {...limitInputProps(FIELD_LIMITS.maintenance.cost)}
            {...register("cost", limitRules<MaintenanceForm, "cost">(FIELD_LIMITS.maintenance.cost, "Cost"))}
          />
          <FieldError error={errors.cost} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mt-vendor">Technician / vendor</Label>
            <Select id="mt-vendor" {...register("vendorId")}>
              <option value="">Select vendor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <FieldError error={errors.vendorId} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mt-performed">Completion date</Label>
            <Input id="mt-performed" type="date" {...register("performedDate")} />
            <p className="text-xs text-muted-fg">Defaults to today when saved as completed.</p>
            <FieldError error={errors.performedDate} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mt-next-due">Next due date</Label>
          <Input id="mt-next-due" type="date" {...register("nextDueDate")} />
          <FieldError error={errors.nextDueDate} />
          <p className="text-xs text-muted-fg">For recurring work; drives the &ldquo;due soon&rdquo; reminders.</p>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-edge-subtle pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={save.isPending}>
            {editingRecord ? "Save changes" : "Schedule task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
