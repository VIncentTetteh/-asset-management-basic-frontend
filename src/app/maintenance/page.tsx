"use client";

import { useState, useEffect, useMemo } from "react";
import { MaintenanceRecord, MaintenanceDto, Asset, MaintenanceType } from "@/types";
import { maintenanceService } from "@/services/maintenanceService";
import { assetService } from "@/services/assetService";
import { supplierService } from "@/services/supplierService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Wrench, Calendar, Hexagon, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";

export default function MaintenancePage() {
    const [records, setRecords] = useState<MaintenanceRecord[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<MaintenanceDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [recordsData, assetsData, suppliersData] = await Promise.all([
                maintenanceService.getAll(),
                assetService.getAll(),
                supplierService.getAll()
            ]);
            setRecords(recordsData);
            setAssets(assetsData);
            setSuppliers(suppliersData);
        } catch (error) {
            toast.error("Failed to load maintenance records");
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

    const handleOpenCreate = () => {
        setEditingRecord(null);
        reset({
            assetId: "",
            scheduledDate: new Date().toISOString().split('T')[0],
            description: "",
            maintenanceType: MaintenanceType.PREVENTIVE,
            cost: 0,
            vendorId: "",
            status: "SCHEDULED"
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (record: MaintenanceRecord) => {
        setEditingRecord(record);
        reset({
            assetId: record.assetId,
            scheduledDate: record.scheduledDate ? record.scheduledDate.split('T')[0] : "",
            performedDate: record.performedDate ? record.performedDate.split('T')[0] : "",
            description: record.description || "",
            maintenanceType: record.maintenanceType,
            cost: record.cost,
            vendorId: record.vendorId || "",
            status: record.status
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this maintenance log?")) return;
        try {
            await maintenanceService.delete(id);
            toast.success("Record deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete record");
            console.error(error);
        }
    };

    const handleComplete = async (id: string) => {
        // Optimistically ask for cost & performed by, or just use backend defaults
        // For simplicity, we'll mark as complete via the service directly
        try {
            await maintenanceService.complete(id);
            toast.success("Maintenance marked as completed");
            fetchData();
        } catch (error) {
            toast.error("Failed to complete maintenance");
        }
    };

    const onSubmit = async (data: MaintenanceDto) => {
        try {
            data.cost = Number(data.cost);

            // Clean empty strings
            Object.keys(data).forEach(key => {
                const k = key as keyof MaintenanceDto;
                if (data[k] === "") {
                    delete (data as any)[k];
                }
            });

            if (editingRecord) {
                await maintenanceService.update(editingRecord.id!, data);
                toast.success("Maintenance record updated");
            } else {
                await maintenanceService.create(data);
                toast.success("Maintenance scheduled successfully");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to save record");
            console.error(error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SCHEDULED': return "bg-blue-100 text-blue-700 border-blue-200";
            case 'IN_PROGRESS': return "bg-amber-100 text-amber-700 border-amber-200";
            case 'COMPLETED': return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case 'CANCELLED': return "bg-slate-100 text-slate-700 border-slate-200";
            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Maintenance</h1>
                    <p className="text-slate-500">Track asset repairs and preventive maintenance schedules.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="mr-2 h-4 w-4" /> Log Maintenance
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                    </div>
                ) : records.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <Wrench className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No maintenance records found</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">Schedule preventive maintenance or log repair work for your assets.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 hover:border-teal-300">
                            Log Maintenance
                        </Button>
                    </div>
                ) : (
                    records.map((record) => (
                        <Card key={record.id} className="overflow-hidden hover:shadow-md transition-all group border-slate-200 flex flex-col">
                            <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="truncate pr-2 w-full">
                                    <div className="flex justify-between items-start mb-1">
                                        <CardTitle className="text-sm font-semibold text-teal-700 flex items-center gap-1.5 uppercase tracking-wide">
                                            <Wrench className="h-3.5 w-3.5" />
                                            {(record.maintenanceType as string).replace('_', ' ')}
                                        </CardTitle>
                                        <div className={`px-2 flex items-center h-5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${getStatusColor(record.status)}`}>
                                            {record.status}
                                        </div>
                                    </div>

                                    <div className="font-medium text-slate-900 truncate mt-2 flex items-center gap-2" title={assetMap.get(record.assetId) || record.assetId}>
                                        <Hexagon className="h-4 w-4 text-slate-400 shrink-0" />
                                        {assetMap.get(record.assetId) || "Unknown Asset"}
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5 ml-6">
                                        {assetTagMap.get(record.assetId) || ""}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col">
                                <div className="space-y-3 text-sm text-slate-600 flex-1">
                                    <p className="line-clamp-2" title={record.description}>{record.description || "No description provided."}</p>

                                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Scheduled</span>
                                            <div className="flex items-center gap-1.5 text-slate-700">
                                                <Calendar className="h-3.5 w-3.5" />
                                                <span>{new Date(record.scheduledDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Cost</span>
                                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                                ${Number(record.cost).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center gap-2 pt-4 border-t border-slate-100 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div>
                                        {record.status !== 'COMPLETED' && (
                                            <Button variant="ghost" size="sm" onClick={() => handleComplete(record.id!)} className="h-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                                                <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Done
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(record)} className="h-8 w-8 p-0">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(record.id!)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
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
                title={editingRecord ? "Edit Maintenance Log" : "Schedule Maintenance"}
                description={editingRecord ? "Update the maintenance details." : "Create a new maintenance or repair ticket for an asset."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="assetId">Target Asset <span className="text-red-500">*</span></Label>
                        <Select id="assetId" {...register("assetId", { required: "Asset is required" })} disabled={!!editingRecord}>
                            <option value="">Select Asset</option>
                            {assets.map((a) => (
                                <option key={a.id} value={a.id}>{a.name} ({a.assetTag || 'NO-TAG'})</option>
                            ))}
                        </Select>
                        {errors.assetId && <p className="text-sm text-red-500">{errors.assetId.message as string}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="maintenanceType">Maintenance Type</Label>
                            <Select id="maintenanceType" {...register("maintenanceType")}>
                                {Object.values(MaintenanceType).map((t) => (
                                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select id="status" {...register("status")}>
                                <option value="SCHEDULED">SCHEDULED</option>
                                <option value="IN_PROGRESS">IN_PROGRESS</option>
                                <option value="COMPLETED">COMPLETED</option>
                                <option value="CANCELLED">CANCELLED</option>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Task Description / Issue</Label>
                        <Input id="description" placeholder="Replace battery and clean fans..." {...register("description")} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="scheduledDate">Scheduled Date <span className="text-red-500">*</span></Label>
                            <Input id="scheduledDate" type="date" {...register("scheduledDate", { required: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cost">Estimated/Actual Cost ($)</Label>
                            <Input id="cost" type="number" step="0.01" min="0" {...register("cost")} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="vendorId">Technician / Vendor</Label>
                            <Select id="vendorId" {...register("vendorId")}>
                                <option value="">Select Vendor</option>
                                {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="performedDate">Completion Date</Label>
                            <Input id="performedDate" type="date" {...register("performedDate")} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                            {editingRecord ? "Save Changes" : "Schedule Task"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
