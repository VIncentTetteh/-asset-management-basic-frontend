"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { qk } from "@/lib/queryClient";

interface CrudService<T, TDto> {
  getAll: () => Promise<T[]>;
  create: (data: TDto) => Promise<T>;
  update: (id: string, data: Partial<TDto>) => Promise<T>;
  delete: (id: string) => Promise<void>;
}

/**
 * Standard list/save/delete hooks for simple CRUD modules — the shape shared
 * by suppliers, contracts, vendor reviews, and most master-data screens.
 * Modules with workflows (approve/reject, spend recording) add their own
 * mutations next to these.
 */
export function makeCrudHooks<T, TDto>(
  moduleName: string,
  service: CrudService<T, TDto>,
  labels: { entity: string },
  extraInvalidations: readonly (readonly string[])[] = [],
) {
  const key = qk.module(moduleName);

  function useList() {
    return useQuery({
      queryKey: key.list(),
      queryFn: () => service.getAll(),
    });
  }

  function useInvalidate() {
    const queryClient = useQueryClient();
    return () => {
      queryClient.invalidateQueries({ queryKey: key.all });
      extraInvalidations.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
    };
  }

  function useSave() {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: ({ id, data }: { id?: string; data: TDto }) =>
        id ? service.update(id, data) : service.create(data),
      onSuccess: (_res, vars) => {
        toast.success(vars.id ? `${labels.entity} updated` : `${labels.entity} created`);
        invalidate();
      },
      onError: (error) => {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          `Failed to save ${labels.entity.toLowerCase()}`;
        toast.error(message);
      },
    });
  }

  function useDelete() {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: (id: string) => service.delete(id),
      onSuccess: () => {
        toast.success(`${labels.entity} deleted`);
        invalidate();
      },
      onError: () => toast.error(`Failed to delete ${labels.entity.toLowerCase()}`),
    });
  }

  return { key, useList, useInvalidate, useSave, useDelete };
}
