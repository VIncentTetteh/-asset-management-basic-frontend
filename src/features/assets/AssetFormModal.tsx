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
import { buildAssetUpdate, normaliseAssetForm } from "@/features/assets/assetPayload";
import { useSaveAsset } from "@/features/assets/hooks";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencyOptions } from "@/components/currency/CurrencyOptions";

function emptyForm(baseCurrency: string): AssetDto {
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
    currency: baseCurrency,
    // Blank = inherit the category's depreciation policy.
    depreciationMethod: "",
    usefulLifeMonths: "",
    residualValue: "",
    warrantyExpiryDate: "",
    status: AssetStatus.IN_STOCK,
    condition: AssetCondition.NEW,
    locationId: "",
    departmentId: "",
    supplierId: "",
    purchaseOrderId: "",
    assignedUserId: "",
  } as unknown as AssetDto;
}

function formFromAsset(asset: Asset, baseCurrency: string): AssetDto {
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
    currency: asset.currency || baseCurrency,
    depreciationMethod: asset.depreciationMethod ?? "",
    // Never invent a useful life: a blank field inherits the category policy.
    usefulLifeMonths: asset.usefulLifeMonths ?? "",
    residualValue: asset.residualValue ?? "",
    warrantyExpiryDate: asset.warrantyExpiryDate ? asset.warrantyExpiryDate.split("T")[0] : "",
    status: asset.status as AssetStatus,
    condition: asset.condition,
    locationId: asset.locationId || "",
    departmentId: asset.departmentId || "",
    supplierId: asset.supplierId || "",
    purchaseOrderId: asset.purchaseOrderId || "",
    assignedUserId: asset.assignedUserId || "",
  } as unknown as AssetDto;
}

/** Options for a relation select, keeping the current value selectable even if it is not in the list. */
function RelationOptions({
  items,
  current,
  label,
}: {
  items: { id?: string; label: string }[];
  current?: string;
  label: string;
}) {
  const missing = Boolean(current) && !items.some((i) => i.id === current);
  return (
    <>
      <option value="">None</option>
      {missing ? <option value={current}>Current {label} (not in list)</option> : null}
      {items.map((i) => (
        <option key={i.id} value={i.id}>{i.label}</option>
      ))}
    </>
  );
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

  const { baseCurrency } = useCurrency();
  useEffect(() => {
    if (isOpen) reset(editingAsset ? formFromAsset(editingAsset, baseCurrency) : emptyForm(baseCurrency));
  }, [isOpen, editingAsset, reset, baseCurrency]);

  const onSubmit = async (data: AssetDto) => {
    if (editingAsset) {
      // Emptied relation selects are sent as explicit clears; untouched fields are omitted.
      const patch = buildAssetUpdate(editingAsset, data);
      if (Object.keys(patch).length === 0) {
        toast("No changes to update");
        return;
      }
      await saveAsset.mutateAsync({ id: editingAsset.id!, data: patch });
    } else {
      await saveAsset.mutateAsync({ data: normaliseAssetForm(data) });
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
                <CurrencyOptions current={editingAsset?.currency} />
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="depreciationMethod">Depreciation</Label>
              <Select id="depreciationMethod" {...register("depreciationMethod")}>
                <option value="">Category policy</option>
                {Object.values(DepreciationMethod).map((m) => (
                  <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="usefulLifeMonths">Useful life (months)</Label>
              <Input
                id="usefulLifeMonths"
                type="number"
                min="1"
                placeholder="Category policy"
                {...register("usefulLifeMonths")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="residualValue">Residual value</Label>
              <Input
                id="residualValue"
                type="number"
                min="0"
                step="0.01"
                placeholder="Category policy"
                {...register("residualValue")}
              />
            </div>
          </div>
          <p className="text-xs text-muted-fg">
            Leave depreciation blank to use the category&apos;s depreciation policy. Assets with no useful life
            anywhere are carried at cost.
          </p>
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
                <RelationOptions items={departments.map((d) => ({ id: d.id, label: d.name }))} current={editingAsset?.departmentId} label="department" />
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationId">Location</Label>
              <Select id="locationId" {...register("locationId")}>
                <RelationOptions items={locations.map((l) => ({ id: l.id, label: l.name }))} current={editingAsset?.locationId} label="location" />
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierId">Supplier</Label>
              <Select id="supplierId" {...register("supplierId")}>
                <RelationOptions items={suppliers.map((s) => ({ id: s.id, label: s.name }))} current={editingAsset?.supplierId} label="supplier" />
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseOrderId">Purchase order</Label>
              <Select id="purchaseOrderId" {...register("purchaseOrderId")}>
                <RelationOptions items={purchaseOrders.map((po) => ({ id: po.id, label: po.poNumber }))} current={editingAsset?.purchaseOrderId} label="purchase order" />
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
