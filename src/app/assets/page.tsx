"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
    Plus, Pencil, Trash2, Hexagon, Building2, Layers, Wrench, Search, Settings,
    MapPin
} from "lucide-react";

import {
    Asset, AssetDto, Department, Organisation, Category, Location, Supplier,
    AssetStatus, AssetCondition, AssetType, DepreciationMethod, PurchaseOrder
} from "@/types";

import { assetService } from "@/services/assetService";
import { departmentService } from "@/services/departmentService";
import { organisationService } from "@/services/organisationService";
import { categoryService } from "@/services/categoryService";
import { locationService } from "@/services/locationService";
import { supplierService } from "@/services/supplierService";
import { purchaseOrderService } from "@/services/purchaseOrderService";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";


export default function AssetsPage() {
    const [assets, setAssets] = useState<Asset[]>([]);

    // Master data
    const [departments, setDepartments] = useState<Department[]>([]);
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<AssetDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const results = await Promise.allSettled([
                assetService.getAll(),
                departmentService.getAll(),
                organisationService.getAll(),
                categoryService.getAll(),
                locationService.getAll(),
                supplierService.getAll(),
                purchaseOrderService.getAll()
            ]);

            const safeGet = <T,>(result: PromiseSettledResult<T[]>, name: string): T[] => {
                if (result.status === "fulfilled") return result.value;
                console.warn(`[Assets] Failed to load ${name}:`, (result as PromiseRejectedResult).reason);
                return [];
            };

            const assetsResult = results[0];
            if (assetsResult.status === "rejected") {
                toast.error("Failed to load assets");
                console.error("[Assets] Asset fetch failed:", assetsResult.reason);
            } else {
                setAssets(assetsResult.value);
            }

            setDepartments(safeGet(results[1] as PromiseSettledResult<Department[]>, "departments"));
            setOrganisations(safeGet(results[2] as PromiseSettledResult<Organisation[]>, "organisations"));
            setCategories(safeGet(results[3] as PromiseSettledResult<Category[]>, "categories"));
            setLocations(safeGet(results[4] as PromiseSettledResult<Location[]>, "locations"));
            setSuppliers(safeGet(results[5] as PromiseSettledResult<Supplier[]>, "suppliers"));
            const posResult = safeGet(results[6] as PromiseSettledResult<PurchaseOrder[]>, "purchase orders");
            setPurchaseOrders(Array.isArray(posResult) ? posResult : []);

        } catch (error) {
            toast.error("Failed to load data");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Lookup Maps for Display
    const orgMap = useMemo(() => new Map(organisations.map(o => [o.id, o.name])), [organisations]);
    const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const catMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    const locMap = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations]);

    const handleOpenCreate = () => {
        setEditingAsset(null);
        reset({
            name: "",
            assetTag: "",
            serialNumber: "",
            barcodeQrCode: "",
            description: "",
            categoryId: "",
            assetType: AssetType.HARDWARE,
            manufacturer: "",
            model: "",
            purchaseDate: new Date().toISOString().split('T')[0],
            purchaseCost: 0,
            currency: "USD",
            depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
            usefulLifeMonths: 36,
            residualValue: 0,
            warrantyExpiryDate: "",
            status: AssetStatus.IN_STOCK,
            condition: AssetCondition.NEW,
            locationId: "",
            departmentId: "",
            supplierId: "",
            assignedUserId: ""
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (asset: Asset) => {
        setEditingAsset(asset);
        reset({
            name: asset.name,
            assetTag: asset.assetTag,
            serialNumber: asset.serialNumber,
            barcodeQrCode: asset.barcodeQrCode,
            description: asset.description,
            categoryId: asset.categoryId,
            assetType: asset.assetType,
            manufacturer: asset.manufacturer,
            model: asset.model,
            purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : "",
            purchaseCost: asset.purchaseCost,
            currency: asset.currency || "USD",
            depreciationMethod: asset.depreciationMethod,
            usefulLifeMonths: asset.usefulLifeMonths || 36,
            residualValue: asset.residualValue,
            warrantyExpiryDate: asset.warrantyExpiryDate ? asset.warrantyExpiryDate.split('T')[0] : "",
            status: asset.status as AssetStatus,
            condition: asset.condition,
            locationId: asset.locationId || "",
            departmentId: asset.departmentId || "",
            supplierId: asset.supplierId || "",
            assignedUserId: asset.assignedUserId || ""
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this asset?")) return;
        try {
            await assetService.delete(id);
            toast.success("Asset deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete asset");
            console.error(error);
        }
    };

    const onSubmit = async (data: AssetDto) => {
        try {
            // Clean up payload: coerce numeric fields
            data.purchaseCost = Number(data.purchaseCost);
            data.usefulLifeMonths = Number(data.usefulLifeMonths);
            data.residualValue = Number(data.residualValue);

            // Remove empty optional strings (send null/absent rather than "")
            (Object.keys(data) as (keyof AssetDto)[]).forEach(key => {
                if (data[key] === "") delete (data as any)[key];
            });

            if (editingAsset) {
                await assetService.update(editingAsset.id!, data);
                toast.success("Asset updated");
            } else {
                await assetService.create(data);
                toast.success("Asset created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to save asset");
            console.error(error);
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'IN_STOCK': return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case 'IN_USE': return "bg-blue-100 text-blue-700 border-blue-200";
            case 'MAINTENANCE': return "bg-amber-100 text-amber-700 border-amber-200";
            case 'DISPOSED':
            case 'RETIRED': return "bg-gray-100 text-gray-700 border-gray-200";
            case 'MISSING': return "bg-red-100 text-red-700 border-red-200";
            default: return "bg-slate-100 text-slate-700 border-gray-200";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Asset Register</h1>
                    <p className="text-slate-500">Comprehensive view of all organizational assets.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            type="search"
                            placeholder="Search assets..."
                            className="pl-8 w-[250px]"
                        />
                    </div>
                    <Button onClick={handleOpenCreate} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="mr-2 h-4 w-4" /> Add Asset
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    </div>
                ) : assets.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <Hexagon className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No assets found</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">Get started by creating your first asset or importing from a CSV file.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300">
                            Create Asset
                        </Button>
                    </div>
                ) : (
                    assets.map((asset) => (
                        <Card key={asset.id} className="overflow-hidden hover:shadow-md transition-all group">
                            <CardHeader className="pb-3 border-b bg-slate-50/50">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="truncate">
                                        <CardTitle className="text-lg font-semibold text-slate-900 truncate" title={asset.name}>
                                            {asset.name}
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-2 mt-1">
                                            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
                                                {asset.assetTag || asset.barcodeQrCode || 'NO-TAG'}
                                            </span>
                                            <span className="truncate">{catMap.get(asset.categoryId || "") || "Uncategorized"}</span>
                                        </CardDescription>
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusStyles(asset.status || "")}`}>
                                        {(asset.status || "UNKNOWN").replace('_', ' ')}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div className="space-y-3 text-sm">
                                    <div className="grid grid-cols-2 gap-2 pb-2">
                                        <div>
                                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Value</p>
                                            <p className="font-medium text-slate-900">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: asset.currency || 'USD' }).format(asset.purchaseCost || 0)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Condition</p>
                                            <p className="font-medium text-slate-900">{asset.condition || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-100 grid gap-2">
                                        <div className="flex items-center text-slate-600">
                                            <MapPin className="h-4 w-4 mr-2 text-slate-400 shrink-0" />
                                            <span className="truncate">{locMap.get(asset.locationId || "") || "No Location assigned"}</span>
                                        </div>
                                        <div className="flex items-center text-slate-600">
                                            <Layers className="h-4 w-4 mr-2 text-slate-400 shrink-0" />
                                            <span className="truncate">{deptMap.get(asset.departmentId || "") || "No Department assigned"}</span>
                                        </div>
                                        {asset.organisationId && (
                                            <div className="flex items-center text-slate-600">
                                                <Building2 className="h-4 w-4 mr-2 text-slate-400 shrink-0" />
                                                <span className="truncate">{orgMap.get(asset.organisationId) || "Unknown Org"}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(asset)} className="h-8">
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(asset.id!)} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingAsset ? "Edit Asset" : "Register New Asset"}
                description={editingAsset ? "Update the master data for this asset." : "Enter the detailed master data for the new asset."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-1">

                    {/* ID & Categorization */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-900 border-b pb-1">Identification & Type</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Asset Name <span className="text-red-500">*</span></Label>
                                <Input id="name" placeholder="Dell XPS 15" {...register("name", { required: "Name is required" })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assetType">Asset Type</Label>
                                <Select id="assetType" {...register("assetType")}>
                                    {Object.values(AssetType).map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assetTag">Asset Tag</Label>
                                <Input id="assetTag" placeholder="AST-2025-001" {...register("assetTag")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="serialNumber">Serial Number</Label>
                                <Input id="serialNumber" placeholder="SN-XXXXXXX" {...register("serialNumber")} />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="categoryId">Category</Label>
                                <Select id="categoryId" {...register("categoryId")}>
                                    <option value="">Select Category</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Manufacture Info */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-900 border-b pb-1">Manufacturer Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    {/* Financials */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-900 border-b pb-1">Financial & Depreciation</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="purchaseDate">Purchase Date</Label>
                                <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="purchaseCost">Cost <span className="text-red-500">*</span></Label>
                                <Input id="purchaseCost" type="number" min="0" step="0.01" {...register("purchaseCost", { required: true, min: 0 })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currency">Currency</Label>
                                <Select id="currency" {...register("currency")}>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                    <option value="GHS">GHS</option>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="depreciationMethod">Depreciation</Label>
                                <Select id="depreciationMethod" {...register("depreciationMethod")}>
                                    {Object.values(DepreciationMethod).map((m) => (
                                        <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                                    ))}
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="usefulLifeMonths">Useful Life (Months)</Label>
                                <Input id="usefulLifeMonths" type="number" min="1" {...register("usefulLifeMonths")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="residualValue">Residual Value</Label>
                                <Input id="residualValue" type="number" min="0" step="0.01" {...register("residualValue")} />
                            </div>
                        </div>
                    </div>

                    {/* Lifecycle & Status */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-900 border-b pb-1">Status & Condition</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="status">Current Status</Label>
                                <Select id="status" {...register("status")}>
                                    {Object.values(AssetStatus).map((s) => (
                                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                    ))}
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="condition">Physical Condition</Label>
                                <Select id="condition" {...register("condition")}>
                                    {Object.values(AssetCondition).map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </Select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="warrantyExpiryDate">Warranty Expiry</Label>
                                <Input id="warrantyExpiryDate" type="date" {...register("warrantyExpiryDate")} />
                            </div>
                        </div>
                    </div>

                    {/* Assignment & Location */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-900 border-b pb-1">Assignment & Location</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <Label htmlFor="purchaseOrderId">Purchase Order</Label>
                                <Select id="purchaseOrderId" {...register("purchaseOrderId")}>
                                    <option value="">None</option>
                                    {purchaseOrders.map((po) => (
                                        <option key={po.id} value={po.id}>{po.poNumber}</option>
                                    ))}
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white/90 backdrop-blur pb-2">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {editingAsset ? "Save Changes" : "Create Asset"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
