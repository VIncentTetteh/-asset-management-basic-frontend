"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { MaintenanceRecord, MaintenanceDto, MaintenanceType, Asset, Supplier } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildPatchPayload } from "@/lib/patch";
import { useSaveMaintenance } from "@/features/maintenance/hooks";

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
  const { register, handleSubmit, reset, formState: { errors } } = useForm<MaintenanceDto>();
  const save = useSaveMaintenance();

  useEffect(() => {
    if (!isOpen) return;
    reset(
      editingRecord
        ? {
            assetId: editingRecord.assetId,
            scheduledDate: editingRecord.scheduledDate ? editingRecord.scheduledDate.split("T")[0] : "",
            performedDate: editingRecord.performedDate ? editingRecord.performedDate.split("T")[0] : "",
            description: editingRecord.description || "",
            maintenanceType: editingRecord.maintenanceType,
            cost: editingRecord.cost,
            currency: editingRecord.currency || "GHS",
            vendorId: editingRecord.vendorId || "",
            status: editingRecord.status,
          }
        : {
            assetId: "",
            scheduledDate: new Date().toISOString().split("T")[0],
            description: "",
            maintenanceType: MaintenanceType.PREVENTIVE,
            cost: 0,
            currency: "GHS",
            vendorId: "",
            status: "SCHEDULED",
          },
    );
  }, [isOpen, editingRecord, reset]);

  const onSubmit = async (data: MaintenanceDto) => {
    data.cost = Number(data.cost);
    Object.keys(data).forEach((key) => {
      const k = key as keyof MaintenanceDto;
      if (data[k] === "") delete (data as unknown as Record<string, unknown>)[k];
    });

    if (editingRecord) {
      const patch = buildPatchPayload<MaintenanceDto>(
        editingRecord as unknown as Partial<MaintenanceDto>,
        data,
      );
      if (Object.keys(patch).length === 0) {
        toast("No changes to update");
        return;
      }
      await save.mutateAsync({ id: editingRecord.id!, data: patch });
    } else {
      await save.mutateAsync({ data });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingRecord ? "Edit maintenance log" : "Schedule maintenance"}
      description={editingRecord ? "Update the maintenance details." : "Create a maintenance or repair ticket for an asset."}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
        <div className="space-y-2">
          <Label htmlFor="mt-assetId">Target asset <span className="text-danger">*</span></Label>
          <Select id="mt-assetId" {...register("assetId", { required: "Asset is required" })} disabled={!!editingRecord}>
            <option value="">Select asset</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "no tag"})</option>
            ))}
          </Select>
          {errors.assetId && <p className="text-sm text-danger">{errors.assetId.message as string}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mt-type">Maintenance type</Label>
            <Select id="mt-type" {...register("maintenanceType")}>
              {Object.values(MaintenanceType).map((t) => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mt-status">Status</Label>
            <Select id="mt-status" {...register("status")}>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mt-description">Task description / issue</Label>
          <Textarea id="mt-description" placeholder="Replace battery and clean fans…" {...register("description")} />
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-edge-subtle pt-4">
          <div className="space-y-2">
            <Label htmlFor="mt-scheduled">Scheduled date <span className="text-danger">*</span></Label>
            <Input id="mt-scheduled" type="date" {...register("scheduledDate", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mt-currency">Currency</Label>
            <Select id="mt-currency" {...register("currency")}>
              <option value="GHS">GHS</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mt-cost">Estimated / actual cost</Label>
          <Input id="mt-cost" type="number" step="0.01" min="0" {...register("cost")} />
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="mt-performed">Completion date</Label>
            <Input id="mt-performed" type="date" {...register("performedDate")} />
          </div>
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
