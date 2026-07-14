"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { assetTransferService } from "@/services/assetTransferService";
import { assetService } from "@/services/assetService";
import { locationService } from "@/services/locationService";
import { departmentService } from "@/services/departmentService";
import { qk } from "@/lib/queryClient";
import type { AssetTransferDto } from "@/types";

const transfersKey = qk.module("transfers");

export function useTransfers() {
  return useQuery({
    queryKey: transfersKey.list(),
    queryFn: () => assetTransferService.getAll(),
  });
}

export function useTransferMasterData() {
  const assets = useQuery({
    queryKey: qk.module("assets-all").list(),
    queryFn: () => assetService.getAll(),
    staleTime: 300_000,
  });
  const locations = useQuery({
    queryKey: qk.module("locations").list(),
    queryFn: () => locationService.getAll(),
    staleTime: 300_000,
  });
  const departments = useQuery({
    queryKey: qk.module("departments").list(),
    queryFn: () => departmentService.getAll(),
    staleTime: 300_000,
  });
  return {
    assets: assets.data ?? [],
    locations: locations.data ?? [],
    departments: departments.data ?? [],
  };
}

function useInvalidateTransfers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: transfersKey.all });
    // Completing a transfer moves the asset.
    queryClient.invalidateQueries({ queryKey: qk.assets.all });
  };
}

export function useCreateTransfer() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (payload: AssetTransferDto) => assetTransferService.create(payload),
    onSuccess: () => {
      toast.success("Transfer requested");
      invalidate();
    },
    onError: () => toast.error("Failed to create transfer request"),
  });
}

export function useTransferAction() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" | "complete" | "delete" }) => {
      switch (action) {
        case "approve": await assetTransferService.approve(id); break;
        case "reject": await assetTransferService.reject(id); break;
        case "complete": await assetTransferService.complete(id); break;
        case "delete": await assetTransferService.delete(id); break;
      }
    },
    onSuccess: (_res, vars) => {
      const messages = {
        approve: "Transfer approved",
        reject: "Transfer rejected",
        complete: "Transfer completed — asset moved",
        delete: "Transfer deleted",
      } as const;
      toast.success(messages[vars.action]);
      invalidate();
    },
    onError: (_err, vars) => toast.error(`Failed to ${vars.action} transfer`),
  });
}
