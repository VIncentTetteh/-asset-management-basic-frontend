"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { auditService, type AuditFilterParams, type AuditItemFilterParams } from "@/services/auditService";
import { departmentService } from "@/services/departmentService";
import { userService } from "@/services/userService";
import { qk } from "@/lib/queryClient";
import { AuditItemStatus, type AssetAuditDto, type AuditItemDiscrepancyRequest, type AuditItemVerifyRequest, type AuditStatus } from "@/types";
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

// ── Count sheet ───────────────────────────────────────────────────────────────

const itemsKey = (auditId: string, params: AuditItemFilterParams) =>
  [...auditsKey.detail(auditId), "items", params] as const;

/** One page of an audit's count sheet. */
export function useAuditItems(auditId: string | null, params: AuditItemFilterParams = {}) {
  return useQuery({
    queryKey: itemsKey(auditId ?? "", params),
    queryFn: () => auditService.listItems(auditId as string, params),
    enabled: Boolean(auditId),
    placeholderData: (prev) => prev,
  });
}

/**
 * Invalidates both the sheet and the audit list: verifying an item moves the
 * audit's progress counters, and flagging one can move its status.
 */
function useInvalidateSheet() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: auditsKey.all });
}

export function useGenerateAuditItems() {
  const invalidate = useInvalidateSheet();
  return useMutation({
    mutationFn: (auditId: string) => auditService.generateItems(auditId),
    onSuccess: (audit) => {
      toast.success(
        audit.totalItemCount
          ? `Count sheet has ${audit.totalItemCount} ${audit.totalItemCount === 1 ? "asset" : "assets"}`
          : "No assets are in scope for this audit",
      );
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to build the count sheet" }),
  });
}

export function useVerifyAuditItem() {
  const invalidate = useInvalidateSheet();
  return useMutation({
    mutationFn: ({ auditId, body }: { auditId: string; body: AuditItemVerifyRequest }) =>
      auditService.verifyItem(auditId, body),
    onSuccess: (item) => {
      // An asset that is not on the sheet comes back as a discrepancy, not a
      // verification; saying "verified" there would be a lie.
      if (item.status === AuditItemStatus.DISCREPANCY) {
        toast.error(`${item.assetTag || item.assetName || "Asset"} is not on this audit's count sheet`);
      } else {
        toast.success(`${item.assetTag || item.assetName || "Asset"} verified`);
      }
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to verify the asset" }),
  });
}

export function useFlagAuditItemDiscrepancy() {
  const invalidate = useInvalidateSheet();
  return useMutation({
    mutationFn: ({ auditId, itemId, body }: {
      auditId: string;
      itemId: string;
      body: AuditItemDiscrepancyRequest;
    }) => auditService.flagItemDiscrepancy(auditId, itemId, body),
    onSuccess: () => {
      toast.success("Discrepancy recorded");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to record the discrepancy" }),
  });
}
