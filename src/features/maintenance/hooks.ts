"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { maintenanceService } from "@/services/maintenanceService";
import { assetService } from "@/services/assetService";
import { supplierService } from "@/services/supplierService";
import { qk } from "@/lib/queryClient";
import type { MaintenanceDto } from "@/types";

const maintenanceKey = qk.module("maintenance");

export function useMaintenanceRecords() {
  return useQuery({
    queryKey: maintenanceKey.list(),
    queryFn: () => maintenanceService.getAll(),
  });
}

export function useMaintenanceMasterData() {
  const assets = useQuery({
    queryKey: qk.module("assets-all").list(),
    queryFn: () => assetService.getAll(),
    staleTime: 300_000,
  });
  const suppliers = useQuery({
    queryKey: qk.module("suppliers").list(),
    queryFn: () => supplierService.getAll(),
    staleTime: 300_000,
  });
  return { assets: assets.data ?? [], suppliers: suppliers.data ?? [] };
}

function useInvalidateMaintenance() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: maintenanceKey.all });
    // Completing maintenance can transition the asset's status.
    queryClient.invalidateQueries({ queryKey: qk.assets.all });
  };
}

export function useSaveMaintenance() {
  const invalidate = useInvalidateMaintenance();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<MaintenanceDto> }) =>
      id ? maintenanceService.update(id, data) : maintenanceService.create(data as MaintenanceDto),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? "Maintenance record updated" : "Maintenance scheduled");
      invalidate();
    },
    onError: () => toast.error("Failed to save record"),
  });
}

export function useCompleteMaintenance() {
  const invalidate = useInvalidateMaintenance();
  return useMutation({
    mutationFn: (id: string) => maintenanceService.complete(id),
    onSuccess: () => {
      toast.success("Maintenance marked as completed");
      invalidate();
    },
    onError: () => toast.error("Failed to complete maintenance"),
  });
}

export function useDeleteMaintenance() {
  const invalidate = useInvalidateMaintenance();
  return useMutation({
    mutationFn: (id: string) => maintenanceService.delete(id),
    onSuccess: () => {
      toast.success("Record deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete record"),
  });
}
