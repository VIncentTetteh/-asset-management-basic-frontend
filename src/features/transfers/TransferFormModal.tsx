"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { ArrowRightLeft } from "lucide-react";
import type { Asset, AssetTransferDto, Department, Location } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTransfer } from "@/features/transfers/hooks";
import { applyApiFieldErrors } from "@/lib/api-validation";
import { buildTransferRequest } from "@/features/transfers/workflow";

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
  const { register, handleSubmit, reset, watch, setValue, setError, formState: { errors } } = useForm<AssetTransferDto>();
  const createTransfer = useCreateTransfer();

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  useEffect(() => {
    if (!isOpen) return;
    reset({
      assetId: "",
      fromDepartmentId: "",
      toDepartmentId: "",
      fromLocationId: "",
      toLocationId: "",
      reason: "",
    });
  }, [isOpen, reset]);

  // Origin fields follow the selected asset's current placement.
  // React Compiler intentionally skips React Hook Form's subscription API.
  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedAssetId = watch("assetId");
  useEffect(() => {
    if (!selectedAssetId) return;
    const asset = assetById.get(selectedAssetId);
    if (!asset) return;
    setValue("fromDepartmentId", asset.departmentId || "");
    setValue("fromLocationId", asset.locationId || "");
  }, [selectedAssetId, assetById, setValue]);

  const onSubmit = async (data: AssetTransferDto) => {
    const asset = data.assetId ? assetById.get(data.assetId) : undefined;
    const request = buildTransferRequest(
      { assetId: data.assetId, toDepartmentId: data.toDepartmentId, toLocationId: data.toLocationId ?? undefined, reason: data.reason },
      asset,
    );
    if ("error" in request) {
      setError("toDepartmentId", { type: "validate", message: request.error });
      return;
    }

    try {
      await createTransfer.mutateAsync(request.body as AssetTransferDto);
      onClose();
    } catch (err) {
      // Toasted by the mutation (e.g. an open transfer already exists).
      applyApiFieldErrors(err, setError);
    }
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

        <div className="grid grid-cols-2 gap-4 rounded-card border border-edge bg-surface-muted p-3">
          <div className="col-span-full mb-1">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <ArrowRightLeft className="h-4 w-4 text-faint-fg" /> Origin (from the asset&apos;s current placement)
            </h4>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromDepartmentId" className="text-xs">From department</Label>
            {/* Display only: the API derives the origin from the asset. */}
            <Select id="fromDepartmentId" {...register("fromDepartmentId")} disabled>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
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
