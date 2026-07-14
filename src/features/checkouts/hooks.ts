"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { checkoutService, type CheckInDto, type CheckoutRecordDto } from "@/services/checkoutService";
import { assetService } from "@/services/assetService";
import { userService } from "@/services/userService";
import { qk } from "@/lib/queryClient";

export function useCheckouts(view: "all" | "overdue") {
  return useQuery({
    queryKey: [...qk.checkouts.list(), view],
    queryFn: () => (view === "overdue" ? checkoutService.listOverdue() : checkoutService.listAll()),
  });
}

/** Assets + users for the checkout form selects. */
export function useCheckoutMasterData() {
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
  return { assets: assets.data ?? [], users: users.data ?? [] };
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
    mutationFn: ({ assetId, userId, dto }: { assetId: string; userId: string; dto: Partial<CheckoutRecordDto> }) =>
      checkoutService.checkOut(assetId, userId, dto),
    onSuccess: () => {
      toast.success("Asset checked out");
      invalidate();
    },
    onError: () => toast.error("Failed to check out asset"),
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
    onError: () => toast.error("Failed to check in asset"),
  });
}
