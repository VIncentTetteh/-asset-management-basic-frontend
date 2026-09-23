"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { DisposalRecord } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSaveDisposal } from "@/features/disposals/hooks";
import { CurrencyOptions } from "@/components/currency/CurrencyOptions";
import { applyApiFieldErrors, reportFormErrors } from "@/lib/api-validation";
import {
  buildDisposalPayload,
  DISPOSAL_DOC_MAX_LENGTH,
  disposalTermsLocked,
  type DisposalForm,
} from "@/features/disposals/workflow";
import { todayLocal } from "@/lib/local-date";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { AssetSearchPicker, type PickedAsset } from "@/components/assets/AssetSearchPicker";
import { AttachmentField, attachAfterCreate, useAttachmentField } from "@/components/ui/attachment-field";

const L = FIELD_LIMITS.disposal;

export function DisposalFormModal({
  isOpen,
  onClose,
  editingDisposal,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingDisposal: DisposalRecord | null;
}) {
  const { register, handleSubmit, reset, setValue, setError, formState: { errors } } = useForm<DisposalForm>();
  const save = useSaveDisposal();
  const locked = disposalTermsLocked(editingDisposal);
  // The picked asset (searched server-side); its id is the form's assetId.
  const [pickedAsset, setPickedAsset] = useState<PickedAsset | null>(null);
  // Compliance certificates are uploaded, not linked. A new request holds the
  // file until the create returns its id (see attachAfterCreate in onSubmit).
  const attachments = useAttachmentField({
    entityType: "DISPOSAL_RECORD",
    entityId: editingDisposal?.id ?? null,
  });

  useEffect(() => {
    if (!isOpen) return;
    attachments.reset();
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
    // `attachments.reset` only clears local picker state; it is stable per modal open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingDisposal, reset]);

  // An edit shows the record's own asset (not changeable); a new request shows the pick.
  const shownAsset: PickedAsset | null = editingDisposal
    ? { id: editingDisposal.assetId, name: editingDisposal.assetName, assetTag: editingDisposal.assetTag }
    : pickedAsset;
  const close = () => {
    setPickedAsset(null);
    onClose();
  };

  const pickAsset = (asset: PickedAsset | null) => {
    setPickedAsset(asset);
    setValue("assetId", asset?.id ?? "", { shouldValidate: true });
  };

  const onSubmit = async (data: DisposalForm) => {
    const payload = buildDisposalPayload(data, editingDisposal);
    try {
      const saved = await save.mutateAsync(
        editingDisposal ? { id: editingDisposal.id!, data: payload } : { data: payload },
      );
      // The record exists now, so the held certificate can finally be attached.
      // A failure here says so rather than passing for a clean save.
      if (!editingDisposal) await attachAfterCreate(attachments, saved?.id, "disposal record");
      close();
    } catch (err) {
      // Toasted by the mutation; keep the form open with field errors marked.
      applyApiFieldErrors(err, setError);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={editingDisposal ? "Edit disposal record" : "Request disposal"}
      description={
        locked
          ? "This disposal is approved: its method, date and recovered value are locked. You can still update the reason and document reference."
          : editingDisposal
            ? "Update the disposal request before it is approved."
            : "Request an asset's disposal. A different user must approve it before the asset is marked disposed."
      }
    >
      <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
        <div className="space-y-2">
          <Label htmlFor="dp-assetId">Asset to dispose <span className="text-danger">*</span></Label>
          <input type="hidden" {...register("assetId", { required: "Asset is required" })} />
          <AssetSearchPicker
            id="dp-assetId"
            value={shownAsset}
            onChange={(a) => pickAsset(a)}
            disabled={!!editingDisposal}
            exclude={(a) => a.status === "DISPOSED"}
            invalid={!!errors.assetId}
          />
          <FieldError error={errors.assetId} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dp-date">Disposal date <span className="text-danger">*</span></Label>
            <Input id="dp-date" type="date" disabled={locked} {...register("disposalDate", { required: "Disposal date is required" })} />
            <FieldError error={errors.disposalDate} />
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
            <FieldError error={errors.disposalMethod} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dp-reason">Primary reason <span className="text-danger">*</span></Label>
          <Textarea
            id="dp-reason"
            placeholder="e.g. End of life, irreparable damage, obsolete"
            {...limitInputProps(L.reason)}
            {...register("reason", {
              ...limitRules<DisposalForm, "reason">(L.reason, "Reason"),
              required: "Reason is required",
              validate: (v) => (v ?? "").trim().length > 0 || "Reason is required",
            })}
          />
          <FieldError error={errors.reason} />
        </div>

        <div className="grid grid-cols-2 gap-4 border-y border-edge-subtle py-4">
          <div className="space-y-2">
            <Label htmlFor="dp-saleValue">Value recovered</Label>
            <Input
              id="dp-saleValue"
              type="number"
              placeholder="0.00"
              disabled={locked}
              {...limitInputProps(L.saleValue)}
              {...register("saleValue", limitRules<DisposalForm, "saleValue">(L.saleValue, "Value recovered"))}
            />
            <FieldError error={errors.saleValue} />
            <p className="text-[11px] text-faint-fg">If the asset was sold or scrapped for cash.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dp-currency">Currency</Label>
            <Select id="dp-currency" disabled={locked} {...register("currency")}>
              <option value="">Asset&apos;s currency</option>
              <CurrencyOptions current={editingDisposal?.currency ?? undefined} />
            </Select>
            <FieldError error={errors.currency} />
          </div>
        </div>

        {/* The stored reference is carried through untouched so a legacy link or
            certificate number is never cleared by the switch to uploads. */}
        {attachments.enabled ? <input type="hidden" {...register("complianceDocumentUrl")} /> : null}
        <AttachmentField
          state={attachments}
          label="Compliance document"
          hint="Certificate of destruction, weighbridge ticket or recycler receipt."
          legacyUrl={editingDisposal?.complianceDocumentUrl}
          fallback={
            <div className="space-y-2">
              <Label htmlFor="dp-doc">Compliance document (link or reference)</Label>
              <Input
                id="dp-doc"
                maxLength={DISPOSAL_DOC_MAX_LENGTH}
                placeholder="https://… or certificate of destruction #12345"
                {...register("complianceDocumentUrl", limitRules<DisposalForm, "complianceDocumentUrl">(L.complianceDocumentUrl, "Compliance document"))}
              />
              <FieldError error={errors.complianceDocumentUrl} />
            </div>
          }
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={close}>Cancel</Button>
          <Button type="submit" variant="destructive" isLoading={save.isPending}>
            {editingDisposal ? "Save changes" : "Request disposal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
