"use client";

import { useState, useEffect, useMemo } from "react";
import { AssetTransfer, AssetTransferDto, Asset, Location, Department } from "@/types";
import { assetTransferService } from "@/services/assetTransferService";
import { assetService } from "@/services/assetService";
import { locationService } from "@/services/locationService";
import { departmentService } from "@/services/departmentService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Trash2, ArrowRightLeft, Hexagon, MapPin, Layers, CheckCircle2, XCircle, ThumbsUp } from "lucide-react";
import { useForm } from "react-hook-form";

export default function TransfersPage() {
    const [transfers, setTransfers] = useState<AssetTransfer[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AssetTransferDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [transfersData, assetsData, locData, deptData] = await Promise.all([
                assetTransferService.getAll(),
                assetService.getAll(),
                locationService.getAll(),
                departmentService.getAll()
            ]);
            setTransfers(transfersData);
            setAssets(assetsData);
            setLocations(locData);
            setDepartments(deptData);
        } catch (error) {
            toast.error("Failed to load transfers");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const assetMap = useMemo(() => new Map(assets.map(a => [a.id, a.name])), [assets]);
    const assetTagMap = useMemo(() => new Map(assets.map(a => [a.id, a.assetTag])), [assets]);
    const locationMap = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations]);
    const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);

    const handleOpenCreate = () => {
        reset({
            assetId: "",
            fromDepartmentId: "",
            toDepartmentId: "",
            fromLocationId: "",
            toLocationId: "",
            requestedById: "",
            reason: "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this transfer request?")) return;
        try {
            await assetTransferService.delete(id);
            toast.success("Transfer deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete transfer");
            console.error(error);
        }
    };

    const handleApprove = async (id: string) => {
        try {
            await assetTransferService.approve(id);
            toast.success("Transfer approved");
            fetchData();
        } catch (e) {
            toast.error("Failed to approve transfer");
        }
    };

    const handleReject = async (id: string) => {
        try {
            await assetTransferService.reject(id);
            toast.success("Transfer rejected");
            fetchData();
        } catch (e) {
            toast.error("Failed to reject transfer");
        }
    };

    const handleComplete = async (id: string) => {
        try {
            await assetTransferService.complete(id);
            toast.success("Transfer completed — asset moved");
            fetchData();
        } catch (e) {
            toast.error("Failed to complete transfer");
        }
    };

    const onSubmit = async (data: AssetTransferDto) => {
        // Remove empty optional fields
        if (!data.fromLocationId) delete data.fromLocationId;
        if (!data.toLocationId) delete data.toLocationId;
        if (!data.reason) delete data.reason;

        try {
            await assetTransferService.create(data);
            toast.success("Transfer requested successfully");
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to create transfer request");
            console.error(error);
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case "COMPLETED": return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case "REQUESTED": return "bg-blue-100 text-blue-700 border-blue-200";
            case "APPROVED": return "bg-indigo-100 text-indigo-700 border-indigo-200";
            case "CANCELLED": return "bg-red-100 text-red-700 border-red-200";
            default: return "bg-slate-100 text-slate-700 border-slate-200";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Asset Transfers</h1>
                    <p className="text-slate-500">Relocate assets between departments or locations.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="mr-2 h-4 w-4" /> Request Transfer
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : transfers.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <ArrowRightLeft className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No transfers found</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">Move assets securely between departments.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                            Request Transfer
                        </Button>
                    </div>
                ) : (
                    transfers.map((transfer) => (
                        <Card key={transfer.id} className="overflow-hidden hover:shadow-md transition-all group border-slate-200 flex flex-col">
                            <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="truncate pr-2 w-full">
                                    <div className="flex justify-between items-start mb-1">
                                        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 truncate pr-2">
                                            <Hexagon className="h-4 w-4 text-indigo-600 shrink-0" />
                                            <span className="truncate" title={assetMap.get(transfer.assetId) || "Unknown Asset"}>
                                                {assetMap.get(transfer.assetId) || "Unknown Asset"}
                                            </span>
                                        </CardTitle>
                                        <div className={`px-2 flex items-center h-5 text-[10px] font-bold rounded-full border shrink-0 ${getStatusStyles(transfer.status || "REQUESTED")}`}>
                                            {(transfer.status || "REQUESTED").replace("_", " ")}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5 ml-5">
                                        {assetTagMap.get(transfer.assetId) || ""}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col justify-between">
                                <div className="space-y-4 text-sm text-slate-600 flex-1 relative">
                                    <div className="absolute left-[8px] top-[20px] bottom-[20px] w-0.5 bg-slate-200 z-0"></div>

                                    {/* FROM */}
                                    <div className="relative z-10 flex gap-3 pb-2">
                                        <div className="mt-0.5 w-4 h-4 rounded-full bg-slate-200 border-2 border-white flex-shrink-0 shadow-sm"></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">From</p>
                                            <div className="bg-slate-50 rounded p-2 border border-slate-100">
                                                {transfer.fromDepartmentId && (
                                                    <div className="flex items-center gap-1.5 text-slate-700 truncate">
                                                        <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                        <span className="truncate">{deptMap.get(transfer.fromDepartmentId) || transfer.fromDepartmentId}</span>
                                                    </div>
                                                )}
                                                {transfer.fromLocationId && (
                                                    <div className="flex items-center gap-1.5 text-slate-700 truncate mt-1">
                                                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                        <span className="truncate">{locationMap.get(transfer.fromLocationId)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* TO */}
                                    <div className="relative z-10 flex gap-3 pt-2">
                                        <div className="mt-0.5 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white flex-shrink-0 shadow-sm"></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1">To</p>
                                            <div className="bg-indigo-50/50 rounded p-2 border border-indigo-100">
                                                {transfer.toDepartmentId && (
                                                    <div className="flex items-center gap-1.5 text-indigo-900 truncate">
                                                        <Layers className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                                                        <span className="truncate">{deptMap.get(transfer.toDepartmentId) || transfer.toDepartmentId}</span>
                                                    </div>
                                                )}
                                                {transfer.toLocationId && (
                                                    <div className="flex items-center gap-1.5 text-indigo-900 truncate mt-1">
                                                        <MapPin className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                                                        <span className="truncate">{locationMap.get(transfer.toLocationId)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center gap-2 pt-4 border-t border-slate-100 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="text-xs text-slate-400 font-medium">
                                        {new Date(transfer.createdAt || new Date()).toLocaleDateString()}
                                    </div>
                                    <div className="flex gap-1.5">
                                        {transfer.status === "REQUESTED" && (
                                            <Button variant="ghost" size="sm" onClick={() => handleApprove(transfer.id!)} className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50" title="Approve">
                                                <ThumbsUp className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {transfer.status === "REQUESTED" && (
                                            <Button variant="ghost" size="sm" onClick={() => handleReject(transfer.id!)} className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50" title="Reject">
                                                <XCircle className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {transfer.status === "APPROVED" && (
                                            <Button variant="ghost" size="sm" onClick={() => handleComplete(transfer.id!)} className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50" title="Complete Transfer">
                                                <CheckCircle2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(transfer.id!)} className="h-8 w-8 p-0 text-red-600 hover:bg-red-50" title="Delete">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Request Asset Transfer"
                description="Move an asset to a new department or location."
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="assetId">Asset <span className="text-red-500">*</span></Label>
                        <Select id="assetId" {...register("assetId", { required: "Asset is required" })}>
                            <option value="">Select Asset</option>
                            {assets.map((a) => (
                                <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "NO-TAG"})</option>
                            ))}
                        </Select>
                        {errors.assetId && <p className="text-sm text-red-500">{errors.assetId.message as string}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="requestedById">Requested By (User ID) <span className="text-red-500">*</span></Label>
                        <Input id="requestedById" placeholder="uuid of the requesting user" {...register("requestedById", { required: "Requester is required" })} />
                        {errors.requestedById && <p className="text-sm text-red-500">{errors.requestedById.message as string}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="col-span-full mb-1">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><ArrowRightLeft className="h-4 w-4" /> Origin</h4>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fromDepartmentId" className="text-xs">From Department <span className="text-red-500">*</span></Label>
                            <Select id="fromDepartmentId" {...register("fromDepartmentId", { required: "Origin department required" })}>
                                <option value="">Select Department</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </Select>
                            {errors.fromDepartmentId && <p className="text-sm text-red-500">{errors.fromDepartmentId.message as string}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fromLocationId" className="text-xs">From Location (optional)</Label>
                            <Select id="fromLocationId" {...register("fromLocationId")}>
                                <option value="">None</option>
                                {locations.map((l) => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                        <div className="col-span-full mb-1">
                            <h4 className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5"><ArrowRightLeft className="h-4 w-4 text-indigo-500" /> Destination</h4>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="toDepartmentId" className="text-xs text-indigo-800">To Department <span className="text-red-500">*</span></Label>
                            <Select id="toDepartmentId" {...register("toDepartmentId", { required: "Destination department required" })}>
                                <option value="">Select Department</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </Select>
                            {errors.toDepartmentId && <p className="text-sm text-red-500">{errors.toDepartmentId.message as string}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="toLocationId" className="text-xs text-indigo-800">To Location (optional)</Label>
                            <Select id="toLocationId" {...register("toLocationId")}>
                                <option value="">None</option>
                                {locations.map((l) => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <Label htmlFor="reason">Reason / Notes</Label>
                        <Input id="reason" placeholder="Department relocation / project requirement" {...register("reason")} />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
                            Submit Request
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
