"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { checkoutService, type CheckInDto, type CheckoutRecordDto } from "@/services/checkoutService";
import { assetService } from "@/services/assetService";
import { userService } from "@/services/userService";
import { employeeService } from "@/services/employeeService";
import type { CheckoutRecipient } from "@/features/checkouts/payload";
import { qk } from "@/lib/queryClient";
import { reportApiError } from "@/lib/api-validation";

export function useCheckouts(view: "all" | "overdue") {
  return useQuery({
    queryKey: [...qk.checkouts.list(), view],
    queryFn: () => (view === "overdue" ? checkoutService.listOverdue() : checkoutService.listAll()),
  });
}

/** Assets, users and active employees for the checkout form selects. */
export function useCheckoutMasterData({ withEmployees = false }: { withEmployees?: boolean } = {}) {
  const assets = useQuery({
    queryKey: qk.module("assets-all").list(),
    queryFn: () => assetService.getAll(),
    staleTime: 300_000,
  });
  const users = useQuery({
    queryKey: qk.module("users").list(),
    queryFn: () => userService.getAll(),
    staleTime: 300_000,
  });
  const employees = useQuery({
    queryKey: [...qk.module("employees").list(), "active-for-checkout"],
    queryFn: () => employeeService.getPaged({ status: "ACTIVE", size: 100 }),
    enabled: withEmployees,
    staleTime: 300_000,
  });
  return { assets: assets.data ?? [], users: users.data ?? [], employees: employees.data?.content ?? [] };
}

function useInvalidateCheckouts() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: qk.checkouts.all });
    // A checkout/check-in changes asset status too.
    queryClient.invalidateQueries({ queryKey: qk.assets.all });
  };
}

export function useCheckOut() {
  const invalidate = useInvalidateCheckouts();
  return useMutation({
    mutationFn: ({ assetId, recipient, dto }: { assetId: string; recipient: CheckoutRecipient; dto: Partial<CheckoutRecordDto> }) =>
      recipient.kind === "employee"
        ? checkoutService.checkOutToEmployee(assetId, recipient.id, dto)
        : checkoutService.checkOut(assetId, recipient.id, dto),
    onSuccess: () => {
      toast.success("Asset checked out");
      invalidate();
    },
    // e.g. 409 "already checked out" — show the API's reason, not a generic line.
    onError: (err) => reportApiError(err, { fallback: "Failed to check out asset" }),
  });
}

export function useCheckIn() {
  const invalidate = useInvalidateCheckouts();
  return useMutation({
    mutationFn: ({ recordId, dto }: { recordId: string; dto: CheckInDto }) =>
      checkoutService.checkIn(recordId, dto),
    onSuccess: () => {
      toast.success("Asset checked in");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to check in asset" }),
  });
}
