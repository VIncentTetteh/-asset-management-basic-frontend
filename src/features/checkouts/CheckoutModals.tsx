"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { PackageCheck, CheckCircle2 } from "lucide-react";
import type { Asset, User } from "@/types";
import type { CheckInDto, CheckoutRecordDto } from "@/services/checkoutService";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCheckIn, useCheckOut } from "@/features/checkouts/hooks";
import { applyApiFieldErrors } from "@/lib/api-validation";
import { buildCheckInPayload, buildCheckOutPayload, CONDITION_MAX_LENGTH } from "@/features/checkouts/payload";

interface CheckoutFormValues {
  assetId: string;
  userId: string;
  expectedReturnDate?: string;
  conditionOnCheckout?: string;
  notes?: string;
}

export function CheckOutModal({
  isOpen,
  onClose,
  assets,
  users,
}: {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  users: User[];
}) {
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<CheckoutFormValues>();
  const checkOut = useCheckOut();

  useEffect(() => {
    if (isOpen) reset({ assetId: "", userId: "", expectedReturnDate: "", conditionOnCheckout: "", notes: "" });
  }, [isOpen, reset]);

  const onSubmit = async (data: CheckoutFormValues) => {
    try {
      await checkOut.mutateAsync({
        assetId: data.assetId,
        userId: data.userId,
        dto: buildCheckOutPayload(data),
      });
      onClose();
    } catch (err) {
      // The mutation already toasted; keep the modal open with the fields marked.
      applyApiFieldErrors(err, setError);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Check out asset"
      description="Issue an asset to a user, with an optional expected return date."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="co-asset">Asset <span className="text-danger">*</span></Label>
          <Select id="co-asset" {...register("assetId", { required: "Asset is required" })}>
            <option value="">Select asset…</option>
            {assets
              .filter((a) => a.status === "IN_STOCK" || a.status === "IN_USE")
              .map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "no tag"})</option>
              ))}
          </Select>
          {errors.assetId && <p className="mt-1 text-xs text-danger">{errors.assetId.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-user">User <span className="text-danger">*</span></Label>
          <Select id="co-user" {...register("userId", { required: "User is required" })}>
            <option value="">Select user…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
            ))}
          </Select>
          {errors.userId && <p className="mt-1 text-xs text-danger">{errors.userId.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-return">Expected return date</Label>
          <Input id="co-return" type="date" {...register("expectedReturnDate")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-condition">Condition on checkout</Label>
          <Input id="co-condition" maxLength={CONDITION_MAX_LENGTH} placeholder="e.g. Good, minor scratches…" {...register("conditionOnCheckout")} />
          {errors.conditionOnCheckout && <p className="mt-1 text-xs text-danger">{errors.conditionOnCheckout.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-notes">Notes</Label>
          <Input id="co-notes" placeholder="Optional notes…" {...register("notes")} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={checkOut.isPending}>
            <PackageCheck className="mr-1.5 h-4 w-4" /> Check out
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CheckInModal({
  record,
  onClose,
}: {
  record: CheckoutRecordDto | null;
  onClose: () => void;
}) {
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<CheckInDto>();
  const checkIn = useCheckIn();

  useEffect(() => {
    if (record) reset({ conditionOnReturn: "", notes: "" });
  }, [record, reset]);

  const onSubmit = async (data: CheckInDto) => {
    if (!record?.id) return;
    try {
      await checkIn.mutateAsync({ recordId: record.id, dto: buildCheckInPayload(data) });
      onClose();
    } catch (err) {
      applyApiFieldErrors(err, setError);
    }
  };

  return (
    <Modal
      isOpen={record !== null}
      onClose={onClose}
      title="Check in asset"
      description={record ? `Return "${record.assetName ?? "asset"}" from ${record.employeeName || record.checkedOutByName || "holder"}.` : ""}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ci-condition">Condition on return</Label>
          <Input id="ci-condition" maxLength={CONDITION_MAX_LENGTH} placeholder="e.g. Good, damaged screen…" {...register("conditionOnReturn")} />
          {errors.conditionOnReturn && <p className="mt-1 text-xs text-danger">{errors.conditionOnReturn.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ci-notes">Notes</Label>
          <Input id="ci-notes" placeholder="Optional return notes…" {...register("notes")} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={checkIn.isPending}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirm return
          </Button>
        </div>
      </form>
    </Modal>
  );
}
