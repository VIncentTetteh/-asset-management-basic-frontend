"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { disposalService } from "@/services/disposalService";
import { assetService } from "@/services/assetService";
import { qk } from "@/lib/queryClient";
import type { DisposalsDto } from "@/types";

const disposalsKey = qk.module("disposals");

export function useDisposals() {
  return useQuery({
    queryKey: disposalsKey.list(),
    queryFn: () => disposalService.getAll(),
  });
}

export function useDisposalAssets() {
  const assets = useQuery({
    queryKey: qk.module("assets-all").list(),
    queryFn: () => assetService.getAll(),
    staleTime: 300_000,
  });
  return assets.data ?? [];
}

function useInvalidateDisposals() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: disposalsKey.all });
    // Disposal transitions the asset to DISPOSED.
    queryClient.invalidateQueries({ queryKey: qk.assets.all });
  };
}

export function useSaveDisposal() {
  const invalidate = useInvalidateDisposals();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<DisposalsDto> }) =>
      id ? disposalService.update(id, data) : disposalService.create(data as DisposalsDto),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? "Disposal record updated" : "Asset disposed");
      invalidate();
    },
    onError: () => toast.error("Failed to save disposal record"),
  });
}

export function useDeleteDisposal() {
  const invalidate = useInvalidateDisposals();
  return useMutation({
    mutationFn: (id: string) => disposalService.delete(id),
    onSuccess: () => {
      toast.success("Disposal record deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete record"),
  });
}
