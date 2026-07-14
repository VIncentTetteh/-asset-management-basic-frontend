"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { assetService, type AssetFilterParams } from "@/services/assetService";
import { departmentService } from "@/services/departmentService";
import { organisationService } from "@/services/organisationService";
import { categoryService } from "@/services/categoryService";
import { locationService } from "@/services/locationService";
import { supplierService } from "@/services/supplierService";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { userService } from "@/services/userService";
import { qk } from "@/lib/queryClient";
import type { AssetDto } from "@/types";

/** URL-driven filter state shared by the toolbar, table, and pagination. */
export function useAssetFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = {
    status: searchParams.get("status") ?? "ALL",
    departmentId: searchParams.get("departmentId") ?? "",
    locationId: searchParams.get("locationId") ?? "",
    purchaseDateFrom: searchParams.get("purchaseDateFrom") ?? "",
    purchaseDateTo: searchParams.get("purchaseDateTo") ?? "",
    assigned: searchParams.get("assigned") ?? "",
    page: Number(searchParams.get("page") ?? "0"),
    sort: searchParams.get("sort") ?? "name,asc",
  };

  const setParam = (key: string, value: string | null) => {
    const p = new URLSearchParams(searchParams.toString());
    if (!value || value === "ALL") p.delete(key);
    else p.set(key, value);
    if (key !== "page") p.delete("page");
    router.push(`?${p.toString()}`);
  };

  const clearAdvanced = () => {
    const p = new URLSearchParams(searchParams.toString());
    ["departmentId", "locationId", "purchaseDateFrom", "purchaseDateTo", "assigned", "page"].forEach((k) =>
      p.delete(k),
    );
    router.push(`?${p.toString()}`);
  };

  const queryParams: AssetFilterParams = {
    search: debouncedSearch || undefined,
    status: filters.status !== "ALL" ? filters.status : undefined,
    departmentId: filters.departmentId || undefined,
    locationId: filters.locationId || undefined,
    purchaseDateFrom: filters.purchaseDateFrom || undefined,
    purchaseDateTo: filters.purchaseDateTo || undefined,
    assigned: filters.assigned === "true" ? true : filters.assigned === "false" ? false : undefined,
    page: filters.page,
    size: 20,
    sort: filters.sort,
  };

  const hasAdvancedFilters = Boolean(
    filters.departmentId || filters.locationId || filters.purchaseDateFrom || filters.purchaseDateTo || filters.assigned,
  );

  return { filters, searchInput, setSearchInput, setParam, clearAdvanced, queryParams, hasAdvancedFilters };
}

export function usePagedAssets(params: AssetFilterParams) {
  return useQuery({
    queryKey: qk.assets.list(params),
    queryFn: () => assetService.getPaged(params),
    placeholderData: (prev) => prev, // keep the table stable while a new page loads
  });
}

export function useAssetStats() {
  return useQuery({
    queryKey: [...qk.assets.all, "stats"],
    queryFn: () => assetService.getStats(),
  });
}

/** Reference data used by filters, forms, and display maps. */
export function useAssetMasterData() {
  const results = useQueries({
    queries: [
      { queryKey: qk.module("departments").list(), queryFn: () => departmentService.getAll(), staleTime: 300_000 },
      { queryKey: qk.module("organisations").list(), queryFn: () => organisationService.getAll(), staleTime: 300_000 },
      { queryKey: qk.module("categories").list(), queryFn: () => categoryService.getAll(), staleTime: 300_000 },
      { queryKey: qk.module("locations").list(), queryFn: () => locationService.getAll(), staleTime: 300_000 },
      { queryKey: qk.module("suppliers").list(), queryFn: () => supplierService.getAll(), staleTime: 300_000 },
      { queryKey: qk.module("purchase-orders").list(), queryFn: () => purchaseOrderService.getAll(), staleTime: 300_000 },
      { queryKey: qk.module("users").list(), queryFn: () => userService.getAll(), staleTime: 300_000 },
    ],
  });
  const [departments, organisations, categories, locations, suppliers, purchaseOrders, users] = results;
  return {
    departments: departments.data ?? [],
    organisations: organisations.data ?? [],
    categories: categories.data ?? [],
    locations: locations.data ?? [],
    suppliers: suppliers.data ?? [],
    purchaseOrders: Array.isArray(purchaseOrders.data) ? purchaseOrders.data : [],
    users: users.data ?? [],
  };
}

function useInvalidateAssets() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: qk.assets.all });
}

export function useDeleteAsset() {
  const invalidate = useInvalidateAssets();
  return useMutation({
    mutationFn: (id: string) => assetService.delete(id),
    onSuccess: () => {
      toast.success("Asset deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete asset"),
  });
}

export function useSaveAsset() {
  const invalidate = useInvalidateAssets();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<AssetDto> }) =>
      id ? assetService.update(id, data) : assetService.create(data as AssetDto),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? "Asset updated" : "Asset created");
      invalidate();
    },
    onError: () => toast.error("Failed to save asset"),
  });
}

export function useAssignAsset() {
  const invalidate = useInvalidateAssets();
  return useMutation({
    mutationFn: ({ assetId, userId }: { assetId: string; userId: string }) =>
      assetService.assignToUser(assetId, userId),
    onSuccess: () => {
      toast.success("Asset assigned");
      invalidate();
    },
    onError: () => toast.error("Failed to assign asset"),
  });
}

export function useUnassignAsset() {
  const invalidate = useInvalidateAssets();
  return useMutation({
    mutationFn: (assetId: string) => assetService.unassignUser(assetId),
    onSuccess: () => {
      toast.success("Asset unassigned");
      invalidate();
    },
    onError: () => toast.error("Failed to unassign asset"),
  });
}
