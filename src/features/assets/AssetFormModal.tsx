"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  Asset, AssetDto, AssetStatus, AssetCondition, AssetType, ProcurementType,
  Category, Department, Location, Supplier, PurchaseOrder,
} from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import {
  assetDepreciationMethods, buildAssetUpdate, editableAssetStatuses, normaliseAssetForm,
} from "@/features/assets/assetPayload";
import { useSaveAsset } from "@/features/assets/hooks";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencyOptions } from "@/components/currency/CurrencyOptions";
import { todayLocal } from "@/lib/local-date";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { reportApiError } from "@/lib/api-validation";

const L = FIELD_LIMITS.asset;

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
    purchaseDate: todayLocal(),
    // Optional, as in the API: an asset can be registered before its cost is known.
    purchaseCost: "",
    currency: baseCurrency,
    // Blank = inherit the category's depreciation policy.
    depreciationMethod: "",
    usefulLifeMonths: "",
    residualValue: "",
    warrantyExpiryDate: "",
    insurancePremiumPerYear: "",
    downtimeCostPerDay: "",
    insurancePolicyExpiry: "",
    status: AssetStatus.IN_STOCK,
    condition: AssetCondition.NEW,
    locationId: "",
    departmentId: "",
    supplierId: "",
    purchaseOrderId: "",
    assignedUserId: "",
    procurementType: "",
    costCenter: "",
    invoiceId: "",
    insurancePolicyId: "",
  } as unknown as AssetDto;
}

function formFromAsset(asset: Asset, baseCurrency: string): AssetDto {
  return {
    name: asset.name,
    assetTag: asset.assetTag ?? "",
    serialNumber: asset.serialNumber ?? "",
    barcodeQrCode: asset.barcodeQrCode,
    description: asset.description ?? "",
    categoryId: asset.categoryId ?? "",
    assetType: asset.assetType,
    manufacturer: asset.manufacturer ?? "",
    model: asset.model ?? "",
    purchaseDate: asset.purchaseDate ? asset.purchaseDate.split("T")[0] : "",
    purchaseCost: asset.purchaseCost ?? "",
    currency: asset.currency || baseCurrency,
    depreciationMethod: asset.depreciationMethod ?? "",
    // Never invent a useful life: a blank field inherits the category policy.
    usefulLifeMonths: asset.usefulLifeMonths ?? "",
    residualValue: asset.residualValue ?? "",
    warrantyExpiryDate: asset.warrantyExpiryDate ? asset.warrantyExpiryDate.split("T")[0] : "",
    insurancePremiumPerYear: asset.insurancePremiumPerYear ?? "",
    downtimeCostPerDay: asset.downtimeCostPerDay ?? "",
    insurancePolicyExpiry: asset.insurancePolicyExpiry ? asset.insurancePolicyExpiry.split("T")[0] : "",
    status: asset.status as AssetStatus,
    condition: asset.condition,
    locationId: asset.locationId || "",
    departmentId: asset.departmentId || "",
    supplierId: asset.supplierId || "",
    purchaseOrderId: asset.purchaseOrderId || "",
    assignedUserId: asset.assignedUserId || "",
    procurementType: asset.procurementType ?? "",
    costCenter: asset.costCenter ?? "",
    invoiceId: asset.invoiceId ?? "",
    insurancePolicyId: asset.insurancePolicyId ?? "",
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
  const { register, handleSubmit, reset, setError, formState: { isSubmitting, errors } } = useForm<AssetDto>();
  const saveAsset = useSaveAsset();

  const { baseCurrency } = useCurrency();
  useEffect(() => {
    if (isOpen) reset(editingAsset ? formFromAsset(editingAsset, baseCurrency) : emptyForm(baseCurrency));
  }, [isOpen, editingAsset, reset, baseCurrency]);

  const onSubmit = async (data: AssetDto) => {
    try {
      if (editingAsset) {
        // Emptied optional fields are sent as explicit clears; untouched fields are omitted.
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
    } catch (error) {
      reportApiError(error, { fallback: "Failed to save asset", setError });
    }
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
              <Input id="name" placeholder="Dell XPS 15" {...limitInputProps(L.name)} {...register("name", limitRules<AssetDto, "name">(L.name, "Name"))} />
              <FieldError error={errors.name} />
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
              <Input id="assetTag" placeholder="AST-2025-001" className="data-mono" {...limitInputProps(L.assetTag)} {...register("assetTag", limitRules<AssetDto, "assetTag">(L.assetTag, "Asset tag"))} />
              <FieldError error={errors.assetTag} />
              {!editingAsset ? (
                <p className="text-xs text-muted-fg">Leave blank to use the category&apos;s next prefix tag, if it has one.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="serialNumber">Serial number</Label>
              <Input id="serialNumber" placeholder="SN-XXXXXXX" className="data-mono" {...limitInputProps(L.serialNumber)} {...register("serialNumber", limitRules<AssetDto, "serialNumber">(L.serialNumber, "Serial number"))} />
              <FieldError error={errors.serialNumber} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="categoryId">Category</Label>
              <Select id="categoryId" {...register("categoryId")}>
                <RelationOptions items={categories.map((c) => ({ id: c.id, label: c.name }))} current={editingAsset?.categoryId} label="category" />
              </Select>
              <FieldError error={errors.categoryId} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} {...register("description")} />
              <FieldError error={errors.description} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeading>Manufacturer details</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input id="manufacturer" placeholder="Dell" {...limitInputProps(L.manufacturer)} {...register("manufacturer", limitRules<AssetDto, "manufacturer">(L.manufacturer, "Manufacturer"))} />
              <FieldError error={errors.manufacturer} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input id="model" placeholder="XPS 15 9520" {...limitInputProps(L.model)} {...register("model", limitRules<AssetDto, "model">(L.model, "Model"))} />
              <FieldError error={errors.model} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeading>Financial &amp; depreciation</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase date</Label>
              <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
              <FieldError error={errors.purchaseDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseCost">Cost</Label>
              <Input id="purchaseCost" type="number" {...limitInputProps(L.purchaseCost)} {...register("purchaseCost", limitRules<AssetDto, "purchaseCost">(L.purchaseCost, "Cost"))} />
              <FieldError error={errors.purchaseCost} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select id="currency" {...register("currency")}>
                <CurrencyOptions current={editingAsset?.currency} />
              </Select>
              <FieldError error={errors.currency} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="procurementType">Procurement type</Label>
              <Select id="procurementType" {...register("procurementType")}>
                <option value="">Not set</option>
                {Object.values(ProcurementType).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
              <FieldError error={errors.procurementType} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costCenter">Cost centre</Label>
              <Input id="costCenter" {...limitInputProps(L.costCenter)} {...register("costCenter", limitRules<AssetDto, "costCenter">(L.costCenter, "Cost centre"))} />
              <FieldError error={errors.costCenter} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceId">Invoice reference</Label>
              <Input id="invoiceId" className="data-mono" {...limitInputProps(L.invoiceId)} {...register("invoiceId", limitRules<AssetDto, "invoiceId">(L.invoiceId, "Invoice reference"))} />
              <FieldError error={errors.invoiceId} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="depreciationMethod">Depreciation</Label>
              <Select id="depreciationMethod" {...register("depreciationMethod")}>
                <option value="">Category policy</option>
                {assetDepreciationMethods(editingAsset?.depreciationMethod).map((m) => (
                  <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                ))}
              </Select>
              <FieldError error={errors.depreciationMethod} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usefulLifeMonths">Useful life (months)</Label>
              <Input
                id="usefulLifeMonths"
                type="number"
                placeholder="Category policy"
                {...limitInputProps(L.usefulLifeMonths)}
                {...register("usefulLifeMonths", limitRules<AssetDto, "usefulLifeMonths">(L.usefulLifeMonths, "Useful life"))}
              />
              <FieldError error={errors.usefulLifeMonths} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="residualValue">Residual value</Label>
              <Input
                id="residualValue"
                type="number"
                placeholder="Category policy"
                {...limitInputProps(L.residualValue)}
                {...register("residualValue", limitRules<AssetDto, "residualValue">(L.residualValue, "Residual value"))}
              />
              <FieldError error={errors.residualValue} />
            </div>
          </div>
          <p className="text-xs text-muted-fg">
            Leave depreciation blank to use the category&apos;s depreciation policy. Assets with no useful life
            anywhere are carried at cost.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="insurancePremiumPerYear">Insurance premium / year</Label>
              <Input
                id="insurancePremiumPerYear"
                type="number"
                {...limitInputProps(L.insurancePremiumPerYear)}
                {...register("insurancePremiumPerYear", limitRules<AssetDto, "insurancePremiumPerYear">(L.insurancePremiumPerYear, "Insurance premium"))}
              />
              <FieldError error={errors.insurancePremiumPerYear} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="downtimeCostPerDay">Downtime cost / day</Label>
              <Input
                id="downtimeCostPerDay"
                type="number"
                {...limitInputProps(L.downtimeCostPerDay)}
                {...register("downtimeCostPerDay", limitRules<AssetDto, "downtimeCostPerDay">(L.downtimeCostPerDay, "Downtime cost"))}
              />
              <FieldError error={errors.downtimeCostPerDay} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurancePolicyExpiry">Insurance policy expiry</Label>
              <Input id="insurancePolicyExpiry" type="date" {...register("insurancePolicyExpiry")} />
              <FieldError error={errors.insurancePolicyExpiry} />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="insurancePolicyId">Insurance policy number</Label>
              <Input id="insurancePolicyId" className="data-mono" {...limitInputProps(L.insurancePolicyId)} {...register("insurancePolicyId", limitRules<AssetDto, "insurancePolicyId">(L.insurancePolicyId, "Insurance policy number"))} />
              <FieldError error={errors.insurancePolicyId} />
            </div>
          </div>
          <p className="text-xs text-muted-fg">
            Insurance and downtime costs feed the asset&apos;s total cost of ownership, in the asset&apos;s currency.
          </p>
        </div>

        <div className="space-y-4">
          <SectionHeading>Status &amp; condition</SectionHeading>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Current status</Label>
              <Select id="status" disabled={editingAsset?.status === AssetStatus.DISPOSED} {...register("status")}>
                {editableAssetStatuses(editingAsset?.status).map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
              <FieldError error={errors.status} />
              <p className="text-xs text-muted-fg">
                {editingAsset?.status === AssetStatus.DISPOSED
                  ? "A disposed asset's status is final."
                  : "To dispose of an asset, raise a disposal request; it needs approval."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="condition">Physical condition</Label>
              <Select id="condition" {...register("condition")}>
                {Object.values(AssetCondition).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <FieldError error={errors.condition} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="warrantyExpiryDate">Warranty expiry</Label>
              <Input id="warrantyExpiryDate" type="date" {...register("warrantyExpiryDate")} />
              <FieldError error={errors.warrantyExpiryDate} />
              {!editingAsset ? (
                <p className="text-xs text-muted-fg">Leave blank to use the category&apos;s default warranty from the purchase date.</p>
              ) : null}
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
              <FieldError error={errors.departmentId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationId">Location</Label>
              <Select id="locationId" {...register("locationId")}>
                <RelationOptions items={locations.map((l) => ({ id: l.id, label: l.name }))} current={editingAsset?.locationId} label="location" />
              </Select>
              <FieldError error={errors.locationId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierId">Supplier</Label>
              <Select id="supplierId" {...register("supplierId")}>
                <RelationOptions items={suppliers.map((s) => ({ id: s.id, label: s.name }))} current={editingAsset?.supplierId} label="supplier" />
              </Select>
              <FieldError error={errors.supplierId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseOrderId">Purchase order</Label>
              <Select id="purchaseOrderId" {...register("purchaseOrderId")}>
                <RelationOptions items={purchaseOrders.map((po) => ({ id: po.id, label: po.poNumber }))} current={editingAsset?.purchaseOrderId} label="purchase order" />
              </Select>
              <FieldError error={errors.purchaseOrderId} />
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
