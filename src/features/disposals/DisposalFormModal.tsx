"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import type { Asset, DisposalRecord, DisposalsDto } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildPatchPayload } from "@/lib/patch";
import { useSaveDisposal } from "@/features/disposals/hooks";
import { useCurrency } from "@/contexts/CurrencyContext";

export function DisposalFormModal({
  isOpen,
  onClose,
  editingDisposal,
  assets,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingDisposal: DisposalRecord | null;
  assets: Asset[];
}) {
  const { symbol } = useCurrency();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<DisposalsDto>();
  const save = useSaveDisposal();

  useEffect(() => {
    if (!isOpen) return;
    reset(
      editingDisposal
        ? {
            assetId: editingDisposal.assetId,
            disposalDate: editingDisposal.disposalDate ? editingDisposal.disposalDate.split("T")[0] : "",
            reason: editingDisposal.reason || "",
            disposalMethod: editingDisposal.disposalMethod || "SCRAP",
            saleValue: editingDisposal.saleValue || 0,
            approvedById: editingDisposal.approvedById || "",
            complianceDocumentUrl: editingDisposal.complianceDocumentUrl || "",
          }
        : {
            assetId: "",
            disposalDate: new Date().toISOString().split("T")[0],
            reason: "",
            disposalMethod: "SCRAP",
            saleValue: 0,
            approvedById: "",
            complianceDocumentUrl: "",
          },
    );
  }, [isOpen, editingDisposal, reset]);

  const onSubmit = async (data: DisposalsDto) => {
    const currentUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
    const approvedById = editingDisposal?.approvedById || currentUser?.id;
    if (!approvedById) {
      toast.error("Cannot submit disposal: approver user ID is missing");
      return;
    }

    const rawSaleValue = data.saleValue as unknown;
    const hasSaleValue = rawSaleValue !== undefined && rawSaleValue !== null && String(rawSaleValue).trim() !== "";
    const saleValue = hasSaleValue ? Number(rawSaleValue) : undefined;
    if (hasSaleValue && (Number.isNaN(saleValue) || (saleValue as number) < 0)) {
      toast.error("Recovered value must be a valid positive number");
      return;
    }

    const payload: DisposalsDto = {
      id: editingDisposal?.id,
      assetId: data.assetId,
      disposalDate: data.disposalDate,
      disposalMethod: data.disposalMethod,
      reason: data.reason || undefined,
      saleValue,
      approvedById,
      complianceDocumentUrl: data.complianceDocumentUrl || undefined,
      organisationId: currentUser?.organisationId || undefined,
    };

    if (editingDisposal) {
      const patch = buildPatchPayload<DisposalsDto>(
        editingDisposal as unknown as Partial<DisposalsDto>,
        payload,
      );
      if (Object.keys(patch).length === 0) {
        toast("No changes to update");
        return;
      }
      await save.mutateAsync({ id: editingDisposal.id!, data: patch });
    } else {
      await save.mutateAsync({ data: payload });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingDisposal ? "Edit disposal record" : "Decommission asset"}
      description={
        editingDisposal
          ? "Update the disposal data."
          : "Permanently remove an asset from active use and log its disposal."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
        <div className="space-y-2">
          <Label htmlFor="dp-assetId">Asset to dispose <span className="text-danger">*</span></Label>
          <Select id="dp-assetId" {...register("assetId", { required: "Asset is required" })} disabled={!!editingDisposal}>
            <option value="">Select target asset</option>
            {assets
              .filter((a) => a.status !== "DISPOSED" || editingDisposal?.assetId === a.id)
              .map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "no tag"})</option>
              ))}
          </Select>
          {errors.assetId && <p className="text-sm text-danger">{errors.assetId.message as string}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dp-date">Disposal date <span className="text-danger">*</span></Label>
            <Input id="dp-date" type="date" {...register("disposalDate", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dp-method">Disposal method</Label>
            <Select id="dp-method" {...register("disposalMethod", { required: true })}>
              <option value="SALE">Sale — sold to buyer</option>
              <option value="SCRAP">Scrap</option>
              <option value="RECYCLING">Recycling</option>
              <option value="TRADE_IN">Trade-in</option>
              <option value="RETURN">Return</option>
              <option value="DONATION">Donation</option>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dp-reason">Primary reason <span className="text-danger">*</span></Label>
          <Textarea id="dp-reason" placeholder="e.g. End of life, irreparable damage, obsolete" {...register("reason", { required: true })} />
        </div>

        <div className="space-y-2 border-y border-edge-subtle py-4">
          <Label htmlFor="dp-saleValue">Value recovered ({symbol})</Label>
          <Input id="dp-saleValue" type="number" step="0.01" min="0" placeholder="0.00" {...register("saleValue")} />
          <p className="text-[11px] text-faint-fg">If the asset was sold or scrapped for cash.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dp-doc">Notes / document references</Label>
          <Textarea id="dp-doc" placeholder="Certificate of destruction #12345…" {...register("complianceDocumentUrl")} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="destructive" isLoading={save.isPending}>
            {editingDisposal ? "Save changes" : "Confirm disposal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
