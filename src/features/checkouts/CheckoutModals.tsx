"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { PackageCheck, CheckCircle2 } from "lucide-react";
import type { Asset, User } from "@/types";
import type { CheckInDto, CheckoutRecordDto } from "@/services/checkoutService";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import { useCheckIn, useCheckOut } from "@/features/checkouts/hooks";
import { applyApiFieldErrors } from "@/lib/api-validation";
import { FIELD_LIMITS, limitRules } from "@/lib/field-limits";
import type { EmployeeDto } from "@/services/employeeService";
import {
  buildCheckInPayload, buildCheckOutPayload, checkoutRecipient, CONDITION_MAX_LENGTH, NOTES_MAX_LENGTH,
} from "@/features/checkouts/payload";

interface CheckoutFormValues {
  assetId: string;
  recipientType: "user" | "employee";
  userId: string;
  employeeId: string;
  expectedReturnDate?: string;
  conditionOnCheckout?: string;
  notes?: string;
}

export function CheckOutModal({
  isOpen,
  onClose,
  assets,
  users,
  employees = [],
  canIssueToEmployees = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  users: User[];
  /** Active employees; issuing to one needs CHECKOUT_ASSET or MANAGE_EMPLOYEES. */
  employees?: EmployeeDto[];
  canIssueToEmployees?: boolean;
}) {
  const { register, handleSubmit, reset, setError, control, formState: { errors } } = useForm<CheckoutFormValues>();
  const checkOut = useCheckOut();
  const recipientType = useWatch({ control, name: "recipientType" });

  useEffect(() => {
    if (isOpen) {
      reset({
        assetId: "", recipientType: "user", userId: "", employeeId: "",
        expectedReturnDate: "", conditionOnCheckout: "", notes: "",
      });
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: CheckoutFormValues) => {
    try {
      await checkOut.mutateAsync({
        assetId: data.assetId,
        recipient: checkoutRecipient(data),
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
      description="Issue an asset to a user or an employee, with an optional expected return date."
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
        {canIssueToEmployees ? (
          <div className="space-y-1.5">
            <Label htmlFor="co-recipient-type">Issue to</Label>
            <Select id="co-recipient-type" {...register("recipientType")}>
              <option value="user">A user account</option>
              <option value="employee">An employee (no login needed)</option>
            </Select>
          </div>
        ) : null}
        {recipientType === "employee" ? (
          <div className="space-y-1.5">
            <Label htmlFor="co-employee">Employee <span className="text-danger">*</span></Label>
            <Select
              id="co-employee"
              {...register("employeeId", {
                validate: (v, values) => values.recipientType !== "employee" || Boolean(v) || "Employee is required",
              })}
            >
              <option value="">Select employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}{e.employeeNumber ? ` (${e.employeeNumber})` : ""}
                </option>
              ))}
            </Select>
            <FieldError error={errors.employeeId} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="co-user">User <span className="text-danger">*</span></Label>
            <Select
              id="co-user"
              {...register("userId", {
                validate: (v, values) => values.recipientType === "employee" || Boolean(v) || "User is required",
              })}
            >
              <option value="">Select user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
              ))}
            </Select>
            <FieldError error={errors.userId} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="co-return">Expected return date</Label>
          <Input id="co-return" type="date" {...register("expectedReturnDate")} />
          <FieldError error={errors.expectedReturnDate} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-condition">Condition on checkout</Label>
          <Input id="co-condition" maxLength={CONDITION_MAX_LENGTH} placeholder="e.g. Good, minor scratches…" {...register("conditionOnCheckout")} />
          {errors.conditionOnCheckout && <p className="mt-1 text-xs text-danger">{errors.conditionOnCheckout.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-notes">Notes</Label>
          <Textarea
            id="co-notes"
            rows={3}
            placeholder="Optional notes…"
            maxLength={NOTES_MAX_LENGTH}
            {...register("notes", limitRules<CheckoutFormValues, "notes">(FIELD_LIMITS.checkout.notes, "Notes"))}
          />
          <FieldError error={errors.notes} />
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
          <Textarea
            id="ci-notes"
            rows={3}
            placeholder="Optional return notes…"
            maxLength={NOTES_MAX_LENGTH}
            {...register("notes", limitRules<CheckInDto, "notes">(FIELD_LIMITS.checkout.notes, "Notes"))}
          />
          <FieldError error={errors.notes} />
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
