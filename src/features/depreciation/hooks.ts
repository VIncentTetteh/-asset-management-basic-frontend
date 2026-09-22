"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { depreciationPolicyService } from "@/services/depreciationPolicyService";
import { qk } from "@/lib/queryClient";
import type { DepreciationPolicyDto } from "@/types";

const policiesKey = qk.module("depreciation-policies");

export function useDepreciationPolicies() {
  return useQuery({
    queryKey: policiesKey.list(),
    queryFn: () => depreciationPolicyService.getAll(),
  });
}

function useInvalidatePolicies() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: policiesKey.all });
}

export function useSavePolicy() {
  const invalidate = useInvalidatePolicies();
  return useMutation({
    // Edits are a full replace (PUT) so a cleared description, life or residual clears.
    mutationFn: ({ id, data }: { id?: string; data: DepreciationPolicyDto }) =>
      id ? depreciationPolicyService.replace(id, data) : depreciationPolicyService.create(data),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? "Depreciation policy updated" : "Depreciation policy created");
      invalidate();
    },
    // Errors are reported by the form, which maps field errors onto its inputs.
  });
}

export function useDeletePolicy() {
  const invalidate = useInvalidatePolicies();
  return useMutation({
    mutationFn: (id: string) => depreciationPolicyService.delete(id),
    onSuccess: () => {
      toast.success("Depreciation policy deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete policy"),
  });
}
