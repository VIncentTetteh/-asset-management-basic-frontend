"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { Asset, DisposalRecord } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSaveDisposal } from "@/features/disposals/hooks";
import { CurrencyOptions } from "@/components/currency/CurrencyOptions";
import { applyApiFieldErrors } from "@/lib/api-validation";
import {
  buildDisposalPayload,
  DISPOSAL_DOC_MAX_LENGTH,
  disposalTermsLocked,
  type DisposalForm,
} from "@/features/disposals/workflow";
import { todayLocal } from "@/lib/local-date";

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
  const { register, handleSubmit, reset, control, setError, formState: { errors } } = useForm<DisposalForm>();
  const save = useSaveDisposal();
  const locked = disposalTermsLocked(editingDisposal);

  useEffect(() => {
    if (!isOpen) return;
    reset(
      editingDisposal
        ? {
            assetId: editingDisposal.assetId,
            disposalDate: editingDisposal.disposalDate ? editingDisposal.disposalDate.split("T")[0] : "",
            reason: editingDisposal.reason || "",
            disposalMethod: editingDisposal.disposalMethod || "SCRAP",
            saleValue: editingDisposal.saleValue ?? "",
            currency: editingDisposal.currency || "",
            complianceDocumentUrl: editingDisposal.complianceDocumentUrl || "",
          }
        : {
            assetId: "",
            disposalDate: todayLocal(),
            reason: "",
            disposalMethod: "SCRAP",
            saleValue: "",
            currency: "",
            complianceDocumentUrl: "",
          },
    );
  }, [isOpen, editingDisposal, reset]);

  const watchedAssetId = useWatch({ control, name: "assetId" });
  const selectedAsset = assets.find((a) => a.id === watchedAssetId);

  const onSubmit = async (data: DisposalForm) => {
    const payload = buildDisposalPayload(data, editingDisposal);
    try {
      await save.mutateAsync(editingDisposal ? { id: editingDisposal.id!, data: payload } : { data: payload });
      onClose();
    } catch (err) {
      // Toasted by the mutation; keep the form open with field errors marked.
      applyApiFieldErrors(err, setError);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingDisposal ? "Edit disposal record" : "Request disposal"}
      description={
        locked
          ? "This disposal is approved: its method, date and recovered value are locked. You can still update the reason and document reference."
          : editingDisposal
            ? "Update the disposal request before it is approved."
            : "Request an asset's disposal. A different user must approve it before the asset is marked disposed."
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
            <Input id="dp-date" type="date" disabled={locked} {...register("disposalDate", { required: "Disposal date is required" })} />
            {errors.disposalDate && <p className="text-sm text-danger">{errors.disposalDate.message as string}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dp-method">Disposal method</Label>
            <Select id="dp-method" disabled={locked} {...register("disposalMethod", { required: true })}>
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
          <Textarea id="dp-reason" placeholder="e.g. End of life, irreparable damage, obsolete" {...register("reason", { required: "Reason is required" })} />
          {errors.reason && <p className="text-sm text-danger">{errors.reason.message as string}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4 border-y border-edge-subtle py-4">
          <div className="space-y-2">
            <Label htmlFor="dp-saleValue">Value recovered</Label>
            <Input id="dp-saleValue" type="number" step="0.01" min="0" placeholder="0.00" disabled={locked} {...register("saleValue", { min: { value: 0, message: "Cannot be negative" } })} />
            {errors.saleValue && <p className="text-sm text-danger">{errors.saleValue.message as string}</p>}
            <p className="text-[11px] text-faint-fg">If the asset was sold or scrapped for cash.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dp-currency">Currency</Label>
            <Select id="dp-currency" disabled={locked} {...register("currency")}>
              <option value="">{selectedAsset?.currency ? `Asset's currency (${selectedAsset.currency})` : "Asset's currency"}</option>
              <CurrencyOptions current={editingDisposal?.currency ?? undefined} />
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dp-doc">Notes / document references</Label>
          <Textarea id="dp-doc" maxLength={DISPOSAL_DOC_MAX_LENGTH} placeholder="Certificate of destruction #12345…" {...register("complianceDocumentUrl")} />
          {errors.complianceDocumentUrl && <p className="text-sm text-danger">{errors.complianceDocumentUrl.message as string}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="destructive" isLoading={save.isPending}>
            {editingDisposal ? "Save changes" : "Request disposal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
