"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { ArrowRightLeft } from "lucide-react";
import toast from "react-hot-toast";
import type { Asset, AssetTransferDto, Department, Location } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTransfer } from "@/features/transfers/hooks";

export function TransferFormModal({
  isOpen,
  onClose,
  assets,
  departments,
  locations,
}: {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  departments: Department[];
  locations: Location[];
}) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<AssetTransferDto>();
  const createTransfer = useCreateTransfer();

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  useEffect(() => {
    if (!isOpen) return;
    const currentUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
    reset({
      assetId: "",
      fromDepartmentId: "",
      toDepartmentId: "",
      fromLocationId: "",
      toLocationId: "",
      requestedById: currentUser?.id || "",
      reason: "",
    });
  }, [isOpen, reset]);

  // Origin fields follow the selected asset's current placement.
  const selectedAssetId = watch("assetId");
  useEffect(() => {
    if (!selectedAssetId) return;
    const asset = assetById.get(selectedAssetId);
    if (!asset) return;
    setValue("fromDepartmentId", asset.departmentId || "");
    setValue("fromLocationId", asset.locationId || "");
  }, [selectedAssetId, assetById, setValue]);

  const onSubmit = async (data: AssetTransferDto) => {
    const currentUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
    const asset = data.assetId ? assetById.get(data.assetId) : undefined;
    const fromDepartmentId = data.fromDepartmentId || asset?.departmentId || "";
    const fromLocationId = data.fromLocationId || asset?.locationId || undefined;
    const requestedById = data.requestedById || currentUser?.id;

    if (!requestedById) {
      toast.error("Cannot submit transfer: requester user ID is missing");
      return;
    }
    if (!fromDepartmentId) {
      toast.error("Selected asset has no source department");
      return;
    }
    if (fromDepartmentId === data.toDepartmentId) {
      toast.error("Destination department must be different from source department");
      return;
    }
    if (fromLocationId && data.toLocationId && fromLocationId === data.toLocationId) {
      toast.error("Destination location must be different from source location");
      return;
    }

    await createTransfer.mutateAsync({
      assetId: data.assetId,
      fromDepartmentId,
      toDepartmentId: data.toDepartmentId,
      requestedById,
      fromLocationId: fromLocationId || undefined,
      toLocationId: data.toLocationId || undefined,
      reason: data.reason || undefined,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request asset transfer"
      description="Move an asset to a new department or location, with an approval trail."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
        <div className="space-y-2">
          <Label htmlFor="assetId">Asset <span className="text-danger">*</span></Label>
          <Select id="assetId" {...register("assetId", { required: "Asset is required" })}>
            <option value="">Select asset</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "no tag"})</option>
            ))}
          </Select>
          {errors.assetId && <p className="text-sm text-danger">{errors.assetId.message as string}</p>}
        </div>

        <Input type="hidden" {...register("requestedById")} />

        <div className="grid grid-cols-2 gap-4 rounded-card border border-edge bg-surface-muted p-3">
          <div className="col-span-full mb-1">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <ArrowRightLeft className="h-4 w-4 text-faint-fg" /> Origin (from the asset's current placement)
            </h4>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromDepartmentId" className="text-xs">From department</Label>
            <Select id="fromDepartmentId" {...register("fromDepartmentId", { required: "Origin department required" })} disabled>
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
            {errors.fromDepartmentId && <p className="text-sm text-danger">{errors.fromDepartmentId.message as string}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromLocationId" className="text-xs">From location</Label>
            <Select id="fromLocationId" {...register("fromLocationId")} disabled>
              <option value="">None</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-card border border-edge bg-brand-soft p-3">
          <div className="col-span-full mb-1">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-brand">
              <ArrowRightLeft className="h-4 w-4" /> Destination
            </h4>
          </div>
          <div className="space-y-2">
            <Label htmlFor="toDepartmentId" className="text-xs">To department <span className="text-danger">*</span></Label>
            <Select id="toDepartmentId" {...register("toDepartmentId", { required: "Destination department required" })}>
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
            {errors.toDepartmentId && <p className="text-sm text-danger">{errors.toDepartmentId.message as string}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="toLocationId" className="text-xs">To location (optional)</Label>
            <Select id="toLocationId" {...register("toLocationId")}>
              <option value="">None</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <Label htmlFor="reason">Reason / notes</Label>
          <Textarea id="reason" placeholder="Department relocation / project requirement" {...register("reason")} />
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-edge-subtle pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={createTransfer.isPending}>Submit request</Button>
        </div>
      </form>
    </Modal>
  );
}
