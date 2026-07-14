"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  employeeService,
  type EmployeeDto,
  type EmployeeChecklistItemDto,
  type EmployeeFilterParams,
} from "@/services/employeeService";
import { departmentService } from "@/services/departmentService";
import { userService } from "@/services/userService";
import { assetService } from "@/services/assetService";
import { qk } from "@/lib/queryClient";

export function usePagedEmployees(params: EmployeeFilterParams) {
  return useQuery({
    queryKey: qk.employees.list(params),
    queryFn: () => employeeService.getPaged(params),
    placeholderData: (prev) => prev,
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: qk.employees.detail(id),
    queryFn: () => employeeService.get(id),
    enabled: !!id,
  });
}

export function useEmployeeAssets(id: string) {
  return useQuery({
    queryKey: qk.employees.assets(id),
    queryFn: () => employeeService.getAssets(id),
    enabled: !!id,
  });
}

export function useEmployeeChecklists(id: string) {
  return useQuery({
    queryKey: qk.employees.checklists(id),
    queryFn: () => employeeService.getChecklists(id),
    enabled: !!id,
  });
}

export function useEmployeeMasterData() {
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
  const assets = useQuery({
    queryKey: qk.module("assets-all").list(),
    queryFn: () => assetService.getAll(),
    staleTime: 300_000,
  });
  return {
    departments: departments.data ?? [],
    users: users.data ?? [],
    assets: assets.data ?? [],
  };
}

function useInvalidateEmployees() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: qk.employees.all });
    // Onboard/offboard checklists issue and return assets.
    queryClient.invalidateQueries({ queryKey: qk.assets.all });
    queryClient.invalidateQueries({ queryKey: qk.checkouts.all });
  };
}

export function useSaveEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: EmployeeDto }) =>
      id ? employeeService.update(id, data) : employeeService.create(data),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? "Employee updated" : "Employee created");
      invalidate();
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to save employee";
      toast.error(message);
    },
  });
}

export function useDeleteEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: (id: string) => employeeService.delete(id),
    onSuccess: () => {
      toast.success("Employee deleted");
      invalidate();
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to delete employee";
      toast.error(message);
    },
  });
}

export function useOnboardEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: EmployeeChecklistItemDto[] }) =>
      employeeService.onboard(id, items),
    onSuccess: () => {
      toast.success("Onboarding started");
      invalidate();
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to start onboarding";
      toast.error(message);
    },
  });
}

export function useOffboardEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: ({ id, extraItems }: { id: string; extraItems?: EmployeeChecklistItemDto[] }) =>
      employeeService.offboard(id, extraItems ?? []),
    onSuccess: () => {
      toast.success("Offboarding started — return items created for every held asset");
      invalidate();
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to start offboarding";
      toast.error(message);
    },
  });
}

export function useCompleteChecklistItem() {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      employeeService.completeChecklistItem(itemId, completed),
    onSuccess: () => invalidate(),
    onError: (error) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to update checklist item";
      toast.error(message);
    },
  });
}
