"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { XCircle } from "lucide-react";
import type { PurchaseOrder } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { reportFormErrors } from "@/lib/api-validation";

interface RejectForm {
  reason: string;
}

/**
 * Rejects a submitted purchase order with the reason the API requires; the
 * reason is kept on the order so the requester learns why.
 */
export function RejectPurchaseOrderModal({
  order,
  isPending,
  onReject,
  onClose,
}: {
  order: PurchaseOrder | null;
  isPending: boolean;
  /** Rejects; resolves when saved, rejects with the API error otherwise. */
  onReject: (order: PurchaseOrder, reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<RejectForm>();
  const limit = FIELD_LIMITS.purchaseOrder.rejectionReason;

  useEffect(() => {
    if (order) reset({ reason: "" });
  }, [order, reset]);

  const onSubmit = async ({ reason }: RejectForm) => {
    if (!order) return;
    try {
      await onReject(order, reason.trim());
      onClose();
    } catch {
      // The workflow mutation already reported the server's reason.
    }
  };

  return (
    <Modal
      isOpen={order !== null}
      onClose={onClose}
      title="Reject purchase order"
      description={order ? `PO ${order.poNumber} will be closed as rejected; the requester sees your reason.` : undefined}
    >
      <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="po-reject-reason">Reason <span className="text-danger">*</span></Label>
          <Textarea
            id="po-reject-reason"
            rows={3}
            placeholder="e.g. Over the quarterly cap; re-quote with another supplier"
            {...limitInputProps(limit)}
            {...register("reason", limitRules<RejectForm, "reason">(limit, "Reason"))}
          />
          <FieldError error={errors.reason} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="destructive" isLoading={isPending}>
            <XCircle className="mr-1.5 h-4 w-4" /> Reject
          </Button>
        </div>
      </form>
    </Modal>
  );
}
