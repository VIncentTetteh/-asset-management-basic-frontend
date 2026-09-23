"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { XCircle } from "lucide-react";
import type { DisposalRecord } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { applyApiFieldErrors, reportFormErrors } from "@/lib/api-validation";
import { useDisposalDecision } from "@/features/disposals/hooks";

interface RejectForm {
  reason: string;
}

/**
 * Confirms rejecting (or, for the requester, withdrawing) a pending disposal and
 * records why; the API requires the reason and keeps it on the approval trail.
 */
export function RejectDisposalModal({
  record,
  withdrawing,
  onClose,
}: {
  record: DisposalRecord | null;
  /** The viewer requested this disposal, so rejecting it withdraws the request. */
  withdrawing: boolean;
  onClose: () => void;
}) {
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<RejectForm>();
  const decide = useDisposalDecision();
  const limit = FIELD_LIMITS.disposal.reason;

  useEffect(() => {
    if (record) reset({ reason: "" });
  }, [record, reset]);

  const onSubmit = async ({ reason }: RejectForm) => {
    if (!record?.id) return;
    try {
      await decide.mutateAsync({ id: record.id, decision: "reject", reason: reason.trim() });
      onClose();
    } catch (err) {
      applyApiFieldErrors(err, setError);
    }
  };

  const asset = record?.assetName ?? "this asset";
  return (
    <Modal
      isOpen={record !== null}
      onClose={onClose}
      title={withdrawing ? "Withdraw disposal request" : "Reject disposal"}
      description={`The disposal of ${asset} will be closed; the asset stays in service.`}
    >
      <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="dp-reject-reason">Reason <span className="text-danger">*</span></Label>
          <Textarea
            id="dp-reject-reason"
            rows={3}
            placeholder={withdrawing ? "e.g. Raised in error" : "e.g. Still under warranty; repair first"}
            {...limitInputProps(limit)}
            {...register("reason", {
              ...limitRules<RejectForm, "reason">(limit, "Reason"),
              required: "Reason is required",
              validate: (v) => v.trim().length > 0 || "Reason is required",
            })}
          />
          <FieldError error={errors.reason} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="destructive" isLoading={decide.isPending}>
            <XCircle className="mr-1.5 h-4 w-4" /> {withdrawing ? "Withdraw" : "Reject"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
