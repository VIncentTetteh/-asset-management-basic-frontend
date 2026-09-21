"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { disposalService } from "@/services/disposalService";
import { assetService } from "@/services/assetService";
import { qk } from "@/lib/queryClient";
import type { DisposalsDto } from "@/types";
import { reportApiError } from "@/lib/api-validation";

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
    // Edits are full-replace PUTs so cleared fields are actually cleared.
    mutationFn: ({ id, data }: { id?: string; data: DisposalsDto }) =>
      id ? disposalService.replace(id, data) : disposalService.create(data),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? "Disposal record updated" : "Disposal requested — awaiting approval");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to save disposal record" }),
  });
}

export function useDisposalDecision() {
  const invalidate = useInvalidateDisposals();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approve" | "reject" }) =>
      decision === "approve" ? disposalService.approve(id) : disposalService.reject(id),
    onSuccess: (_res, vars) => {
      toast.success(vars.decision === "approve" ? "Disposal approved — asset disposed" : "Disposal rejected");
      invalidate();
    },
    // Approval needs a fresh MFA step-up; a cancelled prompt or 409 shows its own message.
    onError: (err, vars) => reportApiError(err, { fallback: `Failed to ${vars.decision} disposal` }),
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
    onError: (err) => reportApiError(err, { fallback: "Failed to delete record" }),
  });
}
