"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { depreciationPolicyService } from "@/services/depreciationPolicyService";
import { authService } from "@/services/authService";
import { qk } from "@/lib/queryClient";
import type { DepreciationPolicyDto } from "@/types";

const policiesKey = qk.module("depreciation-policies");

export function useDepreciationPolicies() {
  return useQuery({
    queryKey: policiesKey.list(),
    queryFn: () => depreciationPolicyService.getAll(),
  });
}

export function useOrgId() {
  const profile = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: () => authService.getProfile(),
    staleTime: 300_000,
  });
  return ((profile.data as { organisationId?: string } | undefined)?.organisationId ?? "") as string;
}

function useInvalidatePolicies() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: policiesKey.all });
}

export function useSavePolicy() {
  const invalidate = useInvalidatePolicies();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<DepreciationPolicyDto> }) =>
      id ? depreciationPolicyService.update(id, data) : depreciationPolicyService.create(data as DepreciationPolicyDto),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? "Depreciation policy updated" : "Depreciation policy created");
      invalidate();
    },
    onError: () => toast.error("Failed to save depreciation policy"),
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
