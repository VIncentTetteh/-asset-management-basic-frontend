"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  Asset, AssetDto, AssetStatus, AssetCondition, AssetType, DepreciationMethod,
  Category, Department, Location, Supplier, PurchaseOrder,
} from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { buildPatchPayload } from "@/lib/patch";
import { useSaveAsset } from "@/features/assets/hooks";

function emptyForm(): AssetDto {
  return {
    name: "",
    assetTag: "",
    serialNumber: "",
    barcodeQrCode: "",
    description: "",
    categoryId: "",
    assetType: AssetType.HARDWARE,
    manufacturer: "",
    model: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    purchaseCost: 0,
    currency: "GHS",
    depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
    usefulLifeMonths: 36,
    residualValue: 0,
    warrantyExpiryDate: "",
    status: AssetStatus.IN_STOCK,
    condition: AssetCondition.NEW,
    locationId: "",
    departmentId: "",
    supplierId: "",
    assignedUserId: "",
  } as AssetDto;
}

function formFromAsset(asset: Asset): AssetDto {
  return {
    name: asset.name,
    assetTag: asset.assetTag,
    serialNumber: asset.serialNumber,
    barcodeQrCode: asset.barcodeQrCode,
    description: asset.description,
    categoryId: asset.categoryId,
    assetType: asset.assetType,
    manufacturer: asset.manufacturer,
    model: asset.model,
    purchaseDate: asset.purchaseDate ? asset.purchaseDate.split("T")[0] : "",
    purchaseCost: asset.purchaseCost,
    currency: asset.currency || "GHS",
    depreciationMethod: asset.depreciationMethod,
    usefulLifeMonths: asset.usefulLifeMonths || 36,
    residualValue: asset.residualValue,
    warrantyExpiryDate: asset.warrantyExpiryDate ? asset.warrantyExpiryDate.split("T")[0] : "",
    status: asset.status as AssetStatus,
    condition: asset.condition,
    locationId: asset.locationId || "",
    departmentId: asset.departmentId || "",
    supplierId: asset.supplierId || "",
    assignedUserId: asset.assignedUserId || "",
  } as AssetDto;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="border-b border-edge-subtle pb-1 text-sm font-bold text-foreground">{children}</h4>;
}

export function AssetFormModal({
  isOpen,
  onClose,
  editingAsset,
  categories,
  departments,
  locations,
  suppliers,
  purchaseOrders,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingAsset: Asset | null;
  categories: Category[];
  departments: Department[];
  locations: Location[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
}) {
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<AssetDto>();
  const saveAsset = useSaveAsset();

  useEffect(() => {
    if (isOpen) reset(editingAsset ? formFromAsset(editingAsset) : emptyForm());
  }, [isOpen, editingAsset, reset]);

  const onSubmit = async (data: AssetDto) => {
    data.purchaseCost = Number(data.purchaseCost);
    data.usefulLifeMonths = Number(data.usefulLifeMonths);
    data.residualValue = Number(data.residualValue);
    (Object.keys(data) as (keyof AssetDto)[]).forEach((key) => {
      if (data[key] === "") delete (data as unknown as Record<string, unknown>)[key];
    });

    if (editingAsset) {
      const patch = buildPatchPayload<AssetDto>(editingAsset as unknown as Partial<AssetDto>, data);
      if (Object.keys(patch).length === 0) {
        toast("No changes to update");
        return;
      }
      await saveAsset.mutateAsync({ id: editingAsset.id!, data: patch });
    } else {
      await saveAsset.mutateAsync({ data });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAsset ? "Edit asset" : "Register new asset"}
      description={editingAsset ? "Update the master data for this asset." : "Enter the master data for the new asset."}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-6 overflow-y-auto p-1">
        <div className="space-y-4">
          <SectionHeading>Identification &amp; type</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Asset name <span className="text-danger">*</span></Label>
              <Input id="name" placeholder="Dell XPS 15" {...register("name", { required: "Name is required" })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assetType">Asset type</Label>
              <Select id="assetType" {...register("assetType")}>
                {Object.values(AssetType).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assetTag">Asset tag</Label>
              <Input id="assetTag" placeholder="AST-2025-001" className="data-mono" {...register("assetTag")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serialNumber">Serial number</Label>
              <Input id="serialNumber" placeholder="SN-XXXXXXX" className="data-mono" {...register("serialNumber")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="categoryId">Category</Label>
              <Select id="categoryId" {...register("categoryId")}>
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeading>Manufacturer details</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input id="manufacturer" placeholder="Dell" {...register("manufacturer")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input id="model" placeholder="XPS 15 9520" {...register("model")} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeading>Financial &amp; depreciation</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase date</Label>
              <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseCost">Cost <span className="text-danger">*</span></Label>
              <Input id="purchaseCost" type="number" min="0" step="0.01" {...register("purchaseCost", { required: true, min: 0 })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select id="currency" {...register("currency")}>
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="depreciationMethod">Depreciation</Label>
              <Select id="depreciationMethod" {...register("depreciationMethod")}>
                {Object.values(DepreciationMethod).map((m) => (
                  <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="usefulLifeMonths">Useful life (months)</Label>
              <Input id="usefulLifeMonths" type="number" min="1" {...register("usefulLifeMonths")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="residualValue">Residual value</Label>
              <Input id="residualValue" type="number" min="0" step="0.01" {...register("residualValue")} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeading>Status &amp; condition</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Current status</Label>
              <Select id="status" {...register("status")}>
                {Object.values(AssetStatus).map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="condition">Physical condition</Label>
              <Select id="condition" {...register("condition")}>
                {Object.values(AssetCondition).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="warrantyExpiryDate">Warranty expiry</Label>
              <Input id="warrantyExpiryDate" type="date" {...register("warrantyExpiryDate")} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeading>Assignment &amp; location</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department</Label>
              <Select id="departmentId" {...register("departmentId")}>
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationId">Location</Label>
              <Select id="locationId" {...register("locationId")}>
                <option value="">None</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierId">Supplier</Label>
              <Select id="supplierId" {...register("supplierId")}>
                <option value="">None</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseOrderId">Purchase order</Label>
              <Select id="purchaseOrderId" {...register("purchaseOrderId")}>
                <option value="">None</option>
                {purchaseOrders.map((po) => (
                  <option key={po.id} value={po.id}>{po.poNumber}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-edge-subtle bg-surface/95 pb-2 pt-4 backdrop-blur">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>
            {editingAsset ? "Save changes" : "Create asset"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
