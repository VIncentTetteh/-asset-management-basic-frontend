"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { reportApiError } from "@/lib/api-validation";
import { bogReportService, bogControlService } from "@/services/complianceService";
import { qk } from "@/lib/queryClient";
import type { BOGControlDto } from "@/types";

const reportKey = [...qk.module("bog-report").all];
const controlsKey = qk.module("bog-controls");

export function useBogReport() {
  return useQuery({
    queryKey: reportKey,
    queryFn: () => bogReportService.getReport(),
  });
}

export function useBogControlsList() {
  return useQuery({
    queryKey: controlsKey.list(),
    queryFn: () => bogControlService.getAll(),
  });
}

function useInvalidateBog() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: reportKey });
    queryClient.invalidateQueries({ queryKey: controlsKey.all });
  };
}

export function useUpsertBogControl() {
  const invalidate = useInvalidateBog();
  return useMutation({
    mutationFn: (data: BOGControlDto) => bogReportService.upsertControl(data),
    onSuccess: (_res, vars) => {
      toast.success(`Control ${vars.directiveRef} saved`);
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to save control" }),
  });
}

export function useUpdateBogControlStatus() {
  const invalidate = useInvalidateBog();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => bogReportService.updateControlStatus(id, status),
    onSuccess: () => {
      toast.success("Status updated");
      invalidate();
    },
    // The server's reason (e.g. a 409 on a closed control) used to be replaced
    // by a generic message.
    onError: (err) => reportApiError(err, { fallback: "Failed to update status" }),
  });
}
