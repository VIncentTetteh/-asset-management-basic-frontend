"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
    Plus, Pencil, Trash2, Hexagon, Layers, Search,
    MapPin, UserRound, UserPlus, UserMinus, Loader2, Upload, FileSpreadsheet,
    CheckCircle2, AlertTriangle, XCircle, FileText, TrendingDown,
    Package, PackageCheck, Wrench, Filter
} from "lucide-react";
import { CardSkeleton } from "@/components/ui/skeleton";

import {
    Asset, AssetDto, AssetImportResult, Department, Organisation, Category,
    Location, Supplier, User, AssetStatus, AssetCondition, AssetType,
    DepreciationMethod, PurchaseOrder
} from "@/types";

import { assetService, PagedAssets } from "@/services/assetService";
import { importJobService, ImportJobResponse } from "@/services/importJobService";
import { departmentService } from "@/services/departmentService";
import { organisationService } from "@/services/organisationService";
import { categoryService } from "@/services/categoryService";
import { locationService } from "@/services/locationService";
import { supplierService } from "@/services/supplierService";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { userService } from "@/services/userService";
import { AssetDetailModal } from "@/components/assets/AssetDetailModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { buildPatchPayload } from "@/lib/patch";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useConfirm } from "@/hooks/useConfirm";



export default function AssetsPage() {
    // Paged result — replaces the flat assets array
    const [pagedResult, setPagedResult] = useState<PagedAssets>({ total: 0, limit: 20, offset: 0, items: [] });
    const [users, setUsers] = useState<User[]>([]);

    // Master data (fetched once)
    const [departments, setDepartments] = useState<Department[]>([]);
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isUnassigning, setIsUnassigning] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importResult, setImportResult] = useState<AssetImportResult | null>(null);
    const [importJobId, setImportJobId] = useState<string | null>(null);
    const [importStatus, setImportStatus] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [selectedAssetForAssignment, setSelectedAssetForAssignment] = useState<Asset | null>(null);
    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [selectedAssetForDetails, setSelectedAssetForDetails] = useState<Asset | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const { format } = useCurrency();
    const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<AssetDto>();
    const searchParams = useSearchParams();
    const router = useRouter();

    // URL-driven filter state
    const statusFilter = searchParams.get("status") ?? "ALL";
    const currentPage  = Number(searchParams.get("page") ?? "0");
    const sortParam    = searchParams.get("sort") ?? "name,asc";

    // Helper: update a URL param and reset page to 0
    const setParam = (key: string, value: string | null) => {
        const p = new URLSearchParams(searchParams.toString());
        if (!value || value === "ALL") p.delete(key); else p.set(key, value);
        p.delete("page");
        router.push(`?${p.toString()}`);
    };

    // 300ms debounce so we don't hit the API on every keystroke
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    // Alias for existing code that references `assets`
    const assets = pagedResult.items;
    const totalPages = Math.ceil(pagedResult.total / 20);

    // Fetch master data once on mount (departments, categories, locations, etc.)
    const fetchMasterData = async () => {
        const safeGet = <T,>(result: PromiseSettledResult<T[]>, name: string): T[] => {
            if (result.status === "fulfilled") return result.value;
            console.warn(`[Assets] Failed to load ${name}:`, (result as PromiseRejectedResult).reason);
            return [];
        };
        const results = await Promise.allSettled([
            departmentService.getAll(),
            organisationService.getAll(),
            categoryService.getAll(),
            locationService.getAll(),
            supplierService.getAll(),
            purchaseOrderService.getAll(),
            userService.getAll()
        ]);
        setDepartments(safeGet(results[0] as PromiseSettledResult<Department[]>, "departments"));
        setOrganisations(safeGet(results[1] as PromiseSettledResult<Organisation[]>, "organisations"));
        setCategories(safeGet(results[2] as PromiseSettledResult<Category[]>, "categories"));
        setLocations(safeGet(results[3] as PromiseSettledResult<Location[]>, "locations"));
        setSuppliers(safeGet(results[4] as PromiseSettledResult<Supplier[]>, "suppliers"));
        const posResult = safeGet(results[5] as PromiseSettledResult<PurchaseOrder[]>, "purchase orders");
        setPurchaseOrders(Array.isArray(posResult) ? posResult : []);
        setUsers(safeGet(results[6] as PromiseSettledResult<User[]>, "users"));
    };

    // Alias used by CRUD handlers (delete, assign, etc.) to re-fetch current page
    const fetchData = () => {
        setIsLoading(true);
        assetService.getPaged({
            search:       debouncedSearch || undefined,
            status:       statusFilter !== "ALL" ? statusFilter : undefined,
            page:         currentPage,
            size:         20,
            sort:         sortParam,
        })
        .then(r => setPagedResult(r))
        .catch(() => toast.error("Failed to load assets"))
        .finally(() => setIsLoading(false));
    };

    useEffect(() => { fetchMasterData(); }, []);

    // Re-fetch assets whenever any filter/page/sort changes
    useEffect(() => {
        setIsLoading(true);
        assetService.getPaged({
            search:       debouncedSearch || undefined,
            status:       statusFilter !== "ALL" ? statusFilter : undefined,
            page:         currentPage,
            size:         20,
            sort:         sortParam,
        })
        .then(r => setPagedResult(r))
        .catch(() => toast.error("Failed to load assets"))
        .finally(() => setIsLoading(false));
    }, [debouncedSearch, statusFilter, currentPage, sortParam]);

    // Lookup Maps for Display
    const orgMap = useMemo(() => new Map(organisations.map(o => [o.id, o.name])), [organisations]);
    const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const catMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    const locMap = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations]);
    const userMap = useMemo(() => new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`])), [users]);

    const { confirm, ConfirmDialog } = useConfirm();

    const assetStats = useMemo(() => ({
        total: pagedResult.total,
        totalValue: assets.reduce((s, a) => s + (a.purchaseCost || 0), 0),
    }), [pagedResult.total, assets]);

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
        if (!await confirm({ message: "Are you sure you want to delete this asset?", variant: "danger" })) return;
        setDeletingId(id);
        try {
            await assetService.delete(id);
            toast.success("Asset deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete asset");
            console.error(error);
        } finally {
            setDeletingId(null);
        }
    };

    const handleOpenAssignModal = (asset: Asset) => {
        setSelectedAssetForAssignment(asset);
        setSelectedAssigneeId(asset.assignedUserId || "");
        setIsAssignModalOpen(true);
    };

    const handleAssignUser = async () => {
        if (!selectedAssetForAssignment?.id || !selectedAssigneeId) {
            toast.error("Select an employee to assign");
            return;
        }
        setIsAssigning(true);
        try {
            await assetService.assignToUser(selectedAssetForAssignment.id, selectedAssigneeId);
            toast.success("Asset assigned to employee");
            setIsAssignModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to assign asset");
            console.error(error);
        } finally {
            setIsAssigning(false);
        }
    };

    const handleUnassignUser = async () => {
        if (!selectedAssetForAssignment?.id) return;
        setIsUnassigning(true);
        try {
            await assetService.unassignUser(selectedAssetForAssignment.id);
            toast.success("Asset unassigned from employee");
            setIsAssignModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to unassign asset");
            console.error(error);
        } finally {
            setIsUnassigning(false);
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
                const patch = buildPatchPayload<AssetDto>(editingAsset as unknown as Partial<AssetDto>, data);
                if (Object.keys(patch).length === 0) {
                    toast("No changes to update");
                    return;
                }
                await assetService.update(editingAsset.id!, patch);
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

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (importJobId && (importStatus === "PENDING" || importStatus === "PROCESSING" || importStatus === "uploading")) {
            interval = setInterval(async () => {
                try {
                    const details = await importJobService.getJobDetails(importJobId);
                    setImportStatus(details.status || "COMPLETED");
                    
                    if (details.status === "COMPLETED" || details.status === "FAILED") {
                        if (details.result) {
                            // Map ImportJobResult to AssetImportResult if needed
                            const result = details.result;
                            setImportResult({
                                totalRows: result.totalRows || 0,
                                imported: result.imported || 0,
                                skipped: result.skipped || 0,
                                errors: (result.errors || []).map(e => ({ row: e.row || 0, message: e.message || "" }))
                            });
                        }
                        if (details.status === "COMPLETED") {
                            toast.success("Bulk import completed successfully");
                            fetchData();
                        }
                        setImportJobId(null);
                    }
                } catch (err) {
                    console.error("Import polling failed", err);
                    clearInterval(interval);
                    setImportJobId(null);
                }
            }, 2000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [importJobId, importStatus]);

    const handleImport = async () => {
        if (!importFile) return;
        setIsImporting(true);
        setImportResult(null);
        setImportJobId(null);
        setImportStatus("uploading");

        try {
            const response = await importJobService.importAssets(importFile);
            
            if (response.jobId) {
                setImportJobId(response.jobId);
                setImportStatus(response.status || "PENDING");
                toast.success("File uploaded. Processing in background...");
            } else if (response.result) {
                // Fallback for immediate processing
                const result = response.result;
                setImportResult({
                    totalRows: result.totalRows || 0,
                    imported: result.imported || 0,
                    skipped: result.skipped || 0,
                    errors: (result.errors || []).map(e => ({ row: e.row || 0, message: e.message || "" }))
                });
                toast.success("Assets imported successfully");
                fetchData();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to start import");
            setImportStatus("FAILED");
        } finally {
            setIsImporting(false);
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

    const STATUS_TABS = [
        { key: "ALL",         label: "All Assets",  count: statusFilter === "ALL" ? pagedResult.total : null },
        { key: "IN_USE",      label: "In Use",       count: null },
        { key: "IN_STOCK",    label: "In Stock",     count: null },
        { key: "MAINTENANCE", label: "Maintenance",  count: null },
        { key: "RETIRED",     label: "Retired",      count: null },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Asset Register"
                subtitle="Comprehensive view of all organizational assets."
                actions={<>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            type="search"
                            placeholder="Search by name, tag, model…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-8 w-[280px]"
                        />
                    </div>
                    <Button variant="outline" onClick={() => { setImportFile(null); setImportResult(null); setIsImportModalOpen(true); }}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Excel
                    </Button>
                    <Button onClick={handleOpenCreate} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="mr-2 h-4 w-4" /> Add Asset
                    </Button>
                </>}
            />

            {/* Summary Stats */}
            {!isLoading && pagedResult.total > 0 && (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
                    {[
                        { label: "Total Assets", value: assetStats.total, icon: <Package className="h-5 w-5" />, color: "bg-slate-100 text-slate-600" },
                        { label: "In Use", value: "—", icon: <PackageCheck className="h-5 w-5" />, color: "bg-blue-100 text-blue-600" },
                        { label: "In Stock", value: "—", icon: <CheckCircle2 className="h-5 w-5" />, color: "bg-emerald-100 text-emerald-600" },
                        { label: "Maintenance", value: "—", icon: <Wrench className="h-5 w-5" />, color: "bg-amber-100 text-amber-600" },
                        { label: "Total Value", value: format(assetStats.totalValue, "USD"), icon: <TrendingDown className="h-5 w-5" />, color: "bg-teal-100 text-teal-700" },
                    ].map((s) => (
                        <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                            <div className={`p-2 rounded-lg shrink-0 ${s.color}`}>{s.icon}</div>
                            <div className="min-w-0">
                                <p className="text-xs text-slate-500 truncate">{s.label}</p>
                                <p className="text-lg font-bold text-slate-900 tabular-nums">{s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 flex-wrap">
                <Filter className="h-4 w-4 text-slate-400 mr-1" />
                {STATUS_TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setParam("status", tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === tab.key
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                        }`}
                    >
                        {tab.label}
                        {tab.count !== null && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusFilter === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
                ) : assets.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <Hexagon className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No assets found</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">
                            {searchInput || statusFilter !== "ALL" ? "Try adjusting your search or filters." : "Get started by creating your first asset or importing from Excel."}
                        </p>
                        {!searchInput && statusFilter === "ALL" && (
                            <Button onClick={handleOpenCreate} className="mt-6 bg-emerald-600 hover:bg-emerald-700">
                                <Plus className="mr-2 h-4 w-4" /> Create Asset
                            </Button>
                        )}
                    </div>
                ) : (
                    assets.map((asset) => {
                        const age = asset.purchaseDate
                            ? Math.floor((Date.now() - new Date(asset.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
                            : null;
                        const hasWarranty = asset.warrantyExpiryDate && new Date(asset.warrantyExpiryDate) > new Date();
                        return (
                        <Card key={asset.id} className="overflow-hidden hover:shadow-lg transition-all duration-200 border-slate-200 flex flex-col">
                            <CardHeader className="pb-3 border-b bg-gradient-to-r from-slate-50 to-white">
                                <div className="flex justify-between items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="text-base font-semibold text-slate-900 truncate leading-snug" title={asset.name}>
                                            {asset.name}
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-2 mt-1.5">
                                            <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 shrink-0">
                                                {asset.assetTag || 'NO-TAG'}
                                            </span>
                                            <span className="truncate text-slate-500 text-xs">{catMap.get(asset.categoryId || "") || "Uncategorized"}</span>
                                        </CardDescription>
                                    </div>
                                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${getStatusStyles(asset.status || "")}`}>
                                        {(asset.status || "UNKNOWN").replace('_', ' ')}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col">
                                {/* Cost & Condition row */}
                                <div className="grid grid-cols-2 gap-3 pb-3 mb-3 border-b border-slate-100">
                                    <div className="bg-emerald-50 rounded-lg p-2.5">
                                        <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider mb-0.5">Purchase Value</p>
                                        <p className="text-sm font-bold text-emerald-900 tabular-nums">
                                            {format(asset.purchaseCost, asset.currency || 'USD')}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-2.5">
                                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Condition</p>
                                        <p className="text-sm font-semibold text-slate-800">{asset.condition || 'N/A'}</p>
                                    </div>
                                </div>

                                {/* Meta info */}
                                <div className="space-y-1.5 text-sm flex-1">
                                    <div className="flex items-center text-slate-600">
                                        <MapPin className="h-3.5 w-3.5 mr-2 text-slate-400 shrink-0" />
                                        <span className="truncate text-xs">{locMap.get(asset.locationId || "") || "No Location"}</span>
                                    </div>
                                    <div className="flex items-center text-slate-600">
                                        <Layers className="h-3.5 w-3.5 mr-2 text-slate-400 shrink-0" />
                                        <span className="truncate text-xs">{deptMap.get(asset.departmentId || "") || "No Department"}</span>
                                    </div>
                                    <div className="flex items-center text-slate-600">
                                        <UserRound className="h-3.5 w-3.5 mr-2 text-slate-400 shrink-0" />
                                        <span className="truncate text-xs">{userMap.get(asset.assignedUserId || "") || "Unassigned"}</span>
                                    </div>
                                </div>

                                {/* Footer badges */}
                                {(age !== null || hasWarranty) && (
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                                        {age !== null && (
                                            <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                                {age} mo old
                                            </span>
                                        )}
                                        {hasWarranty && (
                                            <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                                                ✓ Warranty Active
                                            </span>
                                        )}
                                        {asset.manufacturer && (
                                            <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                                {asset.manufacturer}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Action buttons — always visible */}
                                <div className="flex gap-1.5 mt-3 pt-3 border-t border-slate-100">
                                    <Button variant="outline" size="sm" onClick={() => { setSelectedAssetForDetails(asset); setIsDetailModalOpen(true); }} className="h-8 flex-1 text-xs">
                                        <FileText className="h-3.5 w-3.5 mr-1" /> View
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleOpenAssignModal(asset)} className="h-8 flex-1 text-xs">
                                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(asset)} className="h-8 text-indigo-600 border-indigo-100 hover:bg-indigo-50">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(asset.id!)} isLoading={deletingId === asset.id} className="h-8 text-red-500 hover:bg-red-50">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                        );
                    })
                )}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <span className="text-sm text-slate-500">
                        {pagedResult.offset + 1}–{Math.min(pagedResult.offset + pagedResult.limit, pagedResult.total)} of {pagedResult.total}
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm"
                            disabled={currentPage === 0}
                            onClick={() => setParam("page", String(currentPage - 1))}>
                            Previous
                        </Button>
                        <Button variant="outline" size="sm"
                            disabled={currentPage >= totalPages - 1}
                            onClick={() => setParam("page", String(currentPage + 1))}>
                            Next
                        </Button>
                    </div>
                </div>
            )}

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
                        <Button type="submit" isLoading={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
                            {editingAsset ? "Save Changes" : "Create Asset"}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                title="Employee Assignment"
                description={selectedAssetForAssignment ? `Assign ${selectedAssetForAssignment.name} to an employee.` : "Assign asset to an employee."}
            >
                <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                        <p className="font-medium text-slate-900">{selectedAssetForAssignment?.name || "Selected Asset"}</p>
                        <p className="text-slate-500">{selectedAssetForAssignment?.assetTag || "No tag"}</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="assignee">Assign To Employee</Label>
                        <Select id="assignee" value={selectedAssigneeId} onChange={(e) => setSelectedAssigneeId(e.target.value)}>
                            <option value="">Select Employee</option>
                            {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.firstName} {user.lastName} ({user.email})
                                </option>
                            ))}
                        </Select>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)}>
                            Cancel
                        </Button>
                        {selectedAssetForAssignment?.assignedUserId && (
                            <Button type="button" variant="ghost" onClick={handleUnassignUser} isLoading={isUnassigning} className="text-amber-700 hover:text-amber-800 hover:bg-amber-50">
                                <UserMinus className="h-4 w-4 mr-1" />
                                Unassign
                            </Button>
                        )}
                        <Button type="button" onClick={handleAssignUser} isLoading={isAssigning} className="bg-indigo-600 hover:bg-indigo-700">
                            <UserPlus className="h-4 w-4 mr-1" />
                            Assign
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Import Modal */}
            <Modal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Assets from Excel"
                description="Upload an .xlsx file to bulk-import assets. Bad rows are skipped and reported without aborting the batch."
            >
                <div className="space-y-5">
                    {/* Column reference */}
                    <details className="rounded-lg border border-slate-200 bg-slate-50 text-xs">
                        <summary className="cursor-pointer px-3 py-2 font-semibold text-slate-600 select-none">
                            Expected column order (row 1 = header)
                        </summary>
                        <div className="px-3 pb-3 pt-2 space-y-3">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-slate-500 font-mono">
                                {[
                                    "1 · name *","2 · assetTag","3 · serialNumber","4 · description",
                                    "5 · assetType","6 · manufacturer","7 · model","8 · purchaseDate",
                                    "9 · purchaseCost","10 · currency","11 · depreciationMethod","12 · usefulLifeMonths",
                                    "13 · residualValue","14 · warrantyExpiryDate","15 · status","16 · condition",
                                    "17 · categoryName","18 · locationName","19 · supplierName","20 · departmentName",
                                    "21 · assignedUserEmail","22 · invoiceId","23 · insurancePolicyId",
                                ].map(col => <span key={col}>{col}</span>)}
                            </div>
                            <div className="border-t border-slate-200 pt-2 space-y-1 text-[10px] text-slate-400">
                                <p><span className="font-semibold text-slate-500">categoryName</span> — exact category name as created in your org</p>
                                <p><span className="font-semibold text-slate-500">locationName</span> — exact location name as created in your org</p>
                                <p><span className="font-semibold text-slate-500">supplierName</span> — exact supplier name as created in your org</p>
                                <p><span className="font-semibold text-slate-500">departmentName</span> — department name <em>or</em> department code</p>
                                <p><span className="font-semibold text-slate-500">assignedUserEmail</span> — user email <em>or</em> employeeId</p>
                            </div>
                        </div>
                    </details>

                    {/* File picker */}
                    <div className="space-y-2">
                        <Label htmlFor="importFile">Excel File (.xlsx)</Label>
                        <Input
                            id="importFile"
                            type="file"
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }}
                        />
                    </div>

                    {/* Polling State */}
                    {importJobId && (
                        <div className="flex flex-col items-center justify-center p-8 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-pulse">
                            <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-3" />
                            <p className="text-sm font-bold text-indigo-900 tracking-tight">Status: {importStatus?.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-indigo-600 mt-1">Processing your file on the server. This may take a moment...</p>
                        </div>
                    )}

                    {/* Results */}
                    {importResult && !importJobId && (
                        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 text-sm">
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="rounded-lg bg-slate-50 border border-slate-100 py-2">
                                    <p className="text-xs text-slate-400 uppercase tracking-wide">Total Rows</p>
                                    <p className="text-xl font-bold text-slate-800">{importResult.totalRows}</p>
                                </div>
                                <div className="rounded-lg bg-emerald-50 border border-emerald-100 py-2">
                                    <p className="text-xs text-emerald-600 uppercase tracking-wide flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3" />Imported</p>
                                    <p className="text-xl font-bold text-emerald-700">{importResult.imported}</p>
                                </div>
                                <div className="rounded-lg bg-amber-50 border border-amber-100 py-2">
                                    <p className="text-xs text-amber-600 uppercase tracking-wide flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3" />Skipped</p>
                                    <p className="text-xl font-bold text-amber-700">{importResult.skipped}</p>
                                </div>
                            </div>

                            {importResult.errors.length > 0 && (
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    <p className="text-xs font-semibold text-red-600 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Row errors</p>
                                    {importResult.errors.map((e, i) => (
                                        <div key={i} className="flex gap-2 text-xs bg-red-50 border border-red-100 rounded px-2.5 py-1.5">
                                            <span className="font-mono font-bold text-red-500 shrink-0">Row {e.row}</span>
                                            <span className="text-red-700">{e.message}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>Close</Button>
                        <Button onClick={handleImport} disabled={!importFile || isImporting} className="bg-emerald-600 hover:bg-emerald-700">
                            {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</> : <><Upload className="mr-2 h-4 w-4" />Import</>}
                        </Button>
                    </div>
                </div>
            </Modal>

            <AssetDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                asset={selectedAssetForDetails}
                departments={departments}
                locations={locations}
                categories={categories}
                users={users}
                organisations={organisations}
            />
        {ConfirmDialog}
        </div>
    );
}
