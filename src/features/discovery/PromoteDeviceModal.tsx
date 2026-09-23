"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import type { DiscoveredDevice } from "@/types";
import { categoryService } from "@/services/categoryService";
import { locationService } from "@/services/locationService";
import { qk } from "@/lib/queryClient";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { buildPromotePayload, promoteDefaults, type PromoteForm } from "@/features/discovery/lib";
import { reportFormErrors } from "@/lib/api-validation";

/**
 * Names the asset a discovered device becomes and places it in a category and
 * location. The API records the IP, hostname and open ports in its description.
 */
export function PromoteDeviceModal({
  device,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  device: DiscoveredDevice | null;
  onClose: () => void;
  onSubmit: (device: DiscoveredDevice, body: ReturnType<typeof buildPromotePayload>) => Promise<void>;
  isSubmitting: boolean;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PromoteForm>();
  const categories = useQuery({
    queryKey: qk.module("categories").list(),
    queryFn: () => categoryService.getAll(),
    enabled: device !== null,
    staleTime: 300_000,
  });
  const locations = useQuery({
    queryKey: qk.module("locations").list(),
    queryFn: () => locationService.getAll(),
    enabled: device !== null,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (device) reset(promoteDefaults(device));
  }, [device, reset]);

  return (
    <Modal
      isOpen={device !== null}
      onClose={onClose}
      title="Promote to asset"
      description={device ? `Register ${device.ipAddress} in the asset register.` : ""}
    >
      <form
        onSubmit={handleSubmit((form) => (device ? onSubmit(device, buildPromotePayload(form)) : Promise.resolve()), reportFormErrors)}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="pr-name">Asset name <span className="text-danger">*</span></Label>
          <Input
            id="pr-name"
            {...limitInputProps(FIELD_LIMITS.asset.name)}
            {...register("name", limitRules<PromoteForm, "name">(FIELD_LIMITS.asset.name, "Asset name"))}
          />
          <FieldError error={errors.name} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pr-category">Category</Label>
            <Select id="pr-category" {...register("categoryId")}>
              <option value="">None</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <p className="text-xs text-faint-fg">Its prefix code, if any, sets the asset tag.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-location">Location</Label>
            <Select id="pr-location" {...register("locationId")}>
              <option value="">None</option>
              {(locations.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>
            <ArrowUpRight className="mr-1.5 h-4 w-4" /> Promote
          </Button>
        </div>
      </form>
    </Modal>
  );
}
