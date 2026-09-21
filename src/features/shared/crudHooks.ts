"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { qk } from "@/lib/queryClient";
import { reportApiError } from "@/lib/api-validation";

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
  labels: { entity: string; fields?: Record<string, string> },
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
      // Field-level validation failures are listed by field; pages that also want
      // the messages on their inputs call applyApiFieldErrors in their own catch.
      onError: (error) => {
        reportApiError(error, { fallback: `Failed to save ${labels.entity.toLowerCase()}`, labels: labels.fields });
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
