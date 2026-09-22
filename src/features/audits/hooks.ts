"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { auditService, type AuditFilterParams } from "@/services/auditService";
import { departmentService } from "@/services/departmentService";
import { userService } from "@/services/userService";
import { qk } from "@/lib/queryClient";
import type { AssetAuditDto, AuditStatus } from "@/types";
import { reportApiError } from "@/lib/api-validation";

const auditsKey = qk.module("audits");

export function useAudits(params: AuditFilterParams = {}) {
  return useQuery({
    queryKey: [...auditsKey.list(), params],
    queryFn: () => auditService.getAll(params),
    placeholderData: (prev) => prev,
  });
}

export function useAuditMasterData() {
  const departments = useQuery({
    queryKey: qk.module("departments").list(),
    queryFn: () => departmentService.getAll(),
    staleTime: 300_000,
  });
  const users = useQuery({
    queryKey: qk.module("users").list(),
    queryFn: () => userService.getAll(),
    staleTime: 300_000,
  });
  return {
    departments: departments.data ?? [],
    users: users.data ?? [],
  };
}

function useInvalidateAudits() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: auditsKey.all });
}

export function useCreateAudit() {
  const invalidate = useInvalidateAudits();
  return useMutation({
    mutationFn: (data: Partial<AssetAuditDto>) => auditService.create(data),
    onSuccess: () => {
      toast.success("Audit scheduled");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to save audit" }),
  });
}

export function useUpdateAuditStatus() {
  const invalidate = useInvalidateAudits();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AuditStatus }) => auditService.updateStatus(id, status),
    onSuccess: (_res, vars) => {
      toast.success(`Audit status updated to ${vars.status.replace(/_/g, " ").toLowerCase()}`);
      invalidate();
    },
    // e.g. 409 when the move is not allowed from the current status.
    onError: (err) => reportApiError(err, { fallback: "Failed to update status" }),
  });
}

export function useUpdateAuditRemarks() {
  const invalidate = useInvalidateAudits();
  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string | null }) => auditService.updateRemarks(id, remarks),
    onSuccess: () => {
      toast.success("Audit remarks saved");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to save remarks" }),
  });
}
