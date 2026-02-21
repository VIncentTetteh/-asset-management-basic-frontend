"use client";

import { useState, useEffect, useMemo } from "react";
import { DisposalRecord, DisposalRecordDto, Asset, AssetState, DisposalMethod } from "@/types";
import { disposalService } from "@/services/disposalService";
import { assetService } from "@/services/assetService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Trash, Hexagon, Calendar, DollarSign, FileSignature } from "lucide-react";
import { useForm } from "react-hook-form";

export default function DisposalsPage() {
    const [disposals, setDisposals] = useState<DisposalRecord[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDisposal, setEditingDisposal] = useState<DisposalRecord | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DisposalRecordDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [disposalsData, assetsData] = await Promise.all([
                disposalService.getAll(),
                assetService.getAll()
            ]);
            setDisposals(disposalsData);
            setAssets(assetsData);
        } catch (error) {
            toast.error("Failed to load disposal records");
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
        setEditingDisposal(null);
        reset({
            assetId: "",
            disposalDate: new Date().toISOString().split('T')[0],
            reason: "",
            disposalMethod: "SCRAP",
            saleValue: 0,
            approvedById: "",
            complianceDocumentUrl: ""
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (disposal: DisposalRecord) => {
        setEditingDisposal(disposal);
        reset({
            assetId: disposal.assetId,
            disposalDate: disposal.disposalDate ? disposal.disposalDate.split('T')[0] : "",
            reason: disposal.reason || "",
            disposalMethod: disposal.disposalMethod || "SCRAP",
            saleValue: disposal.saleValue || 0,
            approvedById: disposal.approvedById || "",
            complianceDocumentUrl: disposal.complianceDocumentUrl || ""
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, assetId: string) => {
        if (!confirm("Are you sure you want to delete this disposal record? The asset will need its state reverted manually.")) return;
        try {
            await disposalService.delete(id);
            toast.success("Disposal record deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete record");
            console.error(error);
        }
    };

    const onSubmit = async (data: DisposalRecordDto) => {
        try {
            data.saleValue = Number(data.saleValue);
            if (!data.approvedById) delete data.approvedById;

            if (editingDisposal) {
                await disposalService.update(editingDisposal.id!, data);
                toast.success("Disposal record updated");
            } else {
                await disposalService.create(data);

                // Optimistically update the asset state here if you want:
                // await assetService.update(data.assetId, { ...assets.find(a=>a.id === data.assetId), status: 'DISPOSED' } as any);
                toast.success("Asset marked for disposal");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to save disposal record");
            console.error(error);
        }
    };

    const getMethodStyles = (method: string) => {
        switch (method) {
            case 'SOLD': return "bg-emerald-100 text-emerald-800 border-emerald-200";
            case 'DONATED': return "bg-blue-100 text-blue-800 border-blue-200";
            case 'RECYCLED': return "bg-teal-100 text-teal-800 border-teal-200";
            case 'SCRAPPED': return "bg-slate-200 text-slate-800 border-slate-300";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Asset Disposals</h1>
                    <p className="text-slate-500">Record offboarding and decommissioning of fixed assets.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-slate-800 hover:bg-slate-900">
                    <Trash className="mr-2 h-4 w-4" /> Decommission Asset
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
                    </div>
                ) : disposals.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <FileSignature className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No disposals found</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">When an asset reaches the end of its lifecycle, you can log its disposal here for auditing purposes.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300">
                            Decommission Asset
                        </Button>
                    </div>
                ) : (
                    disposals.map((disposal) => (
                        <Card key={disposal.id} className="overflow-hidden hover:shadow-md transition-all group border-slate-200 flex flex-col grayscale-[0.2] hover:grayscale-0">
                            <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-3 bg-red-50/50 border-b border-red-100">
                                <div className="truncate pr-2 w-full">
                                    <div className="flex justify-between items-start mb-1">
                                        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 truncate pr-2">
                                            <Hexagon className="h-4 w-4 text-slate-600 shrink-0" />
                                            <span className="truncate line-through decoration-slate-400" title={assetMap.get(disposal.assetId) || "Unknown Asset"}>
                                                {assetMap.get(disposal.assetId) || "Unknown Asset"}
                                            </span>
                                        </CardTitle>
                                        <div className={`px-2 flex items-center h-5 text-[10px] font-bold rounded-full border shrink-0 ${getMethodStyles(disposal.disposalMethod)}`}>
                                            {disposal.disposalMethod}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5 ml-5">
                                        {assetTagMap.get(disposal.assetId) || ""}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col justify-between">
                                <div className="space-y-3 text-sm text-slate-600 flex-1">
                                    <p className="line-clamp-2 italic" title={disposal.reason}>"{disposal.reason}"</p>

                                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-100">
                                        <div className="flex justify-between items-center text-slate-700">
                                            <span className="text-xs font-semibold uppercase text-slate-400">Date</span>
                                            <div className="flex items-center gap-1.5 font-medium">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                <span>{new Date(disposal.disposalDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        {disposal.saleValue && disposal.saleValue > 0 ? (
                                            <div className="flex justify-between items-center text-emerald-700">
                                                <span className="text-xs font-semibold uppercase text-emerald-500">Recovered</span>
                                                <div className="flex items-center gap-1 font-bold">
                                                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span>{Number(disposal.saleValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                    {disposal.complianceDocumentUrl && (
                                        <p className="text-xs text-slate-500 pt-2 border-t border-slate-100 mt-2 line-clamp-1 truncate" title={disposal.complianceDocumentUrl}>
                                            <b className="text-slate-600">Notes:</b> {disposal.complianceDocumentUrl}
                                        </p>
                                    )}
                                </div>

                                <div className="flex justify-end items-center gap-2 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(disposal)} className="h-8 w-8 p-0">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(disposal.id!, disposal.assetId)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
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
                title={editingDisposal ? "Edit Disposal Record" : "Decommission Asset"}
                description={editingDisposal ? "Update the disposal data." : "Permanently remove an asset from active use and log its disposal."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="assetId">Asset to Dispose <span className="text-red-500">*</span></Label>
                        <Select id="assetId" {...register("assetId", { required: "Asset is required" })} disabled={!!editingDisposal}>
                            <option value="">Select Target Asset</option>
                            {/* In a real scenario we'd filter out already disposed assets, but let's list them all for simplicity here */}
                            {assets.filter(a => a.status !== 'DISPOSED' || editingDisposal?.assetId === a.id).map((a) => (
                                <option key={a.id} value={a.id}>{a.name} ({a.assetTag || 'NO-TAG'})</option>
                            ))}
                        </Select>
                        {errors.assetId && <p className="text-sm text-red-500">{errors.assetId.message as string}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="disposalDate">Disposal Date <span className="text-red-500">*</span></Label>
                            <Input id="disposalDate" type="date" {...register("disposalDate", { required: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="disposalMethod">Disposal Method</Label>
                            <Select id="disposalMethod" {...register("disposalMethod")}>
                                <option value="SCRAP">Scrapped / Trashed</option>
                                <option value="SALE">Sold</option>
                                <option value="DONATION">Donated</option>
                                <option value="RECYCLING">Recycled</option>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reason">Primary Reason <span className="text-red-500">*</span></Label>
                        <Input id="reason" placeholder="e.g. End of Life, Irreparable damage, Obsolete" {...register("reason", { required: true })} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-4 border-b pb-4">
                        <div className="space-y-2">
                            <Label htmlFor="saleValue">Value Recovered ($)</Label>
                            <Input id="saleValue" type="number" step="0.01" min="0" placeholder="0.00" {...register("saleValue")} />
                            <p className="text-[10px] text-slate-500">If asset was sold or scrapped for cash.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="complianceDocumentUrl">Additional Notes / Document References</Label>
                        <Input id="complianceDocumentUrl" placeholder="Certificate of destruction #12345 attached via email..." {...register("complianceDocumentUrl")} />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white">
                            {editingDisposal ? "Save Changes" : "Confirm Disposal"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
