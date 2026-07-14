"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { auditService } from "@/services/auditService";
import { departmentService } from "@/services/departmentService";
import { userService } from "@/services/userService";
import { authService } from "@/services/authService";
import { qk } from "@/lib/queryClient";
import type { AssetAuditDto, AuditStatus } from "@/types";

const auditsKey = qk.module("audits");

export function useAudits() {
  return useQuery({
    queryKey: auditsKey.list(),
    queryFn: () => auditService.getAll(),
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
  const profile = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: () => authService.getProfile(),
    staleTime: 300_000,
  });
  return {
    departments: departments.data ?? [],
    users: users.data ?? [],
    orgId: ((profile.data as { organisationId?: string } | undefined)?.organisationId ?? "") as string,
  };
}

function useInvalidateAudits() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: auditsKey.all });
}

export function useCreateAudit() {
  const invalidate = useInvalidateAudits();
  return useMutation({
    mutationFn: (data: AssetAuditDto) => auditService.create(data),
    onSuccess: () => {
      toast.success("Audit scheduled");
      invalidate();
    },
    onError: () => toast.error("Failed to save audit"),
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
    onError: () => toast.error("Failed to update status"),
  });
}

export function useDeleteAudit() {
  const invalidate = useInvalidateAudits();
  return useMutation({
    mutationFn: (id: string) => auditService.delete(id),
    onSuccess: () => {
      toast.success("Audit deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete audit"),
  });
}
