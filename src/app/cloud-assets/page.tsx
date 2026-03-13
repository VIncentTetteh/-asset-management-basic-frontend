"use client";

import { useState, useEffect } from "react";
import { CloudAsset, CloudAssetDto, CloudCostSummary, CloudMonthlyCostDto } from "@/types";
import { cloudAssetService } from "@/services/cloudAssetService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Cloud, DollarSign } from "lucide-react";
import { useForm } from "react-hook-form";

const PROVIDER_COLORS: Record<string, string> = {
    AWS: "bg-orange-100 text-orange-700",
    AZURE: "bg-blue-100 text-blue-700",
    GCP: "bg-red-100 text-red-700",
    ALIBABA: "bg-amber-100 text-amber-700",
    ORACLE_CLOUD: "bg-red-100 text-red-800",
    IBM_CLOUD: "bg-slate-100 text-slate-700",
    OTHER: "bg-slate-100 text-slate-500",
};

const STATUS_STYLES: Record<string, string> = {
    RUNNING: "bg-emerald-100 text-emerald-700 border-emerald-200",
    STOPPED: "bg-amber-100 text-amber-700 border-amber-200",
    TERMINATED: "bg-slate-100 text-slate-500 border-slate-200",
    PENDING: "bg-blue-100 text-blue-700 border-blue-200",
    UNKNOWN: "bg-slate-100 text-slate-400 border-slate-200",
};

export default function CloudAssetsPage() {
    const [assets, setAssets] = useState<CloudAsset[]>([]);
    const [costSummary, setCostSummary] = useState<CloudCostSummary | null>(null);
    const [filterProvider, setFilterProvider] = useState("");
    const [filterEnvironment, setFilterEnvironment] = useState("");
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCostModalOpen, setIsCostModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<CloudAsset | null>(null);
    const [costAssetId, setCostAssetId] = useState("");

    const assetForm = useForm<CloudAssetDto>();
    const costForm = useForm<CloudMonthlyCostDto>();

    const fetchAll = async (p = 0) => {
        try {
            setIsLoading(true);
            const [assetsResult, summaryResult] = await Promise.allSettled([
                cloudAssetService.getAll({
                    provider: filterProvider || undefined,
                    environment: filterEnvironment || undefined,
                    page: p, size: 20,
                }),
                cloudAssetService.getCostSummary(),
            ]);
            if (assetsResult.status === "fulfilled") {
                setAssets(assetsResult.value.content ?? []);
                setTotalPages(assetsResult.value.totalPages ?? 0);
            }
            if (summaryResult.status === "fulfilled") setCostSummary(summaryResult.value);
        } catch {
            toast.error("Failed to load cloud assets");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(page); }, [page, filterProvider, filterEnvironment]);

    const handleOpenCreate = () => {
        setEditingAsset(null);
        assetForm.reset({ name: "", provider: "AWS", region: "", resourceId: "", resourceType: "VIRTUAL_MACHINE", status: "RUNNING", environment: "PROD", currency: "USD" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (asset: CloudAsset) => {
        setEditingAsset(asset);
        assetForm.reset({
            name: asset.name, provider: asset.provider, region: asset.region,
            resourceId: asset.resourceId, resourceType: asset.resourceType,
            status: asset.status, accountId: asset.accountId || "",
            monthlyCostEstimate: asset.monthlyCostEstimate ?? undefined,
            currency: asset.currency || "USD", environment: asset.environment,
            tags: asset.tags || "", description: asset.description || "",
        });
        setIsModalOpen(true);
    };

    const handleOpenCost = (id: string) => {
        setCostAssetId(id);
        costForm.reset({ billingMonth: "", amount: 0, serviceName: "" });
        setIsCostModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this cloud asset?")) return;
        setDeletingId(id);
        try {
            await cloudAssetService.delete(id);
            toast.success("Asset deleted");
            fetchAll(page);
        } catch {
            toast.error("Failed to delete");
        } finally {
            setDeletingId(null);
        }
    };

    const onSubmitAsset = async (data: CloudAssetDto) => {
        try {
            if (editingAsset) {
                await cloudAssetService.update(editingAsset.id, data);
                toast.success("Asset updated");
            } else {
                await cloudAssetService.create(data);
                toast.success("Asset created");
            }
            setIsModalOpen(false);
            fetchAll(page);
        } catch {
            toast.error("Failed to save asset");
        }
    };

    const onSubmitCost = async (data: CloudMonthlyCostDto) => {
        try {
            await cloudAssetService.recordMonthlyCost(costAssetId, { ...data, amount: Number(data.amount) });
            toast.success("Cost recorded");
            setIsCostModalOpen(false);
            fetchAll(page);
        } catch {
            toast.error("Failed to record cost");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Cloud Assets</h1>
                    <p className="text-slate-500">Track and manage your cloud infrastructure resources.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Cloud Asset
                </Button>
            </div>

            {costSummary && (
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-slate-200 md:col-span-1">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg"><DollarSign className="h-5 w-5 text-blue-600" /></div>
                            <div>
                                <p className="text-xs text-slate-500">Total Monthly Cost</p>
                                <p className="text-xl font-bold text-slate-900">{costSummary.currency} {costSummary.totalMonthlyCost.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-slate-200 md:col-span-1">
                        <CardHeader className="pb-1 pt-3 px-4"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">By Provider</p></CardHeader>
                        <CardContent className="px-4 pb-3 space-y-1">
                            {Object.entries(costSummary.costByProvider || {}).map(([p, v]) => (
                                <div key={p} className="flex justify-between text-sm">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${PROVIDER_COLORS[p] || "bg-slate-100 text-slate-500"}`}>{p}</span>
                                    <span className="font-medium text-slate-700">{costSummary.currency} {v.toLocaleString()}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Card className="border-slate-200 md:col-span-1">
                        <CardHeader className="pb-1 pt-3 px-4"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">By Environment</p></CardHeader>
                        <CardContent className="px-4 pb-3 space-y-1">
                            {Object.entries(costSummary.costByEnvironment || {}).map(([e, v]) => (
                                <div key={e} className="flex justify-between text-sm">
                                    <span className="text-slate-600">{e}</span>
                                    <span className="font-medium text-slate-700">{costSummary.currency} {v.toLocaleString()}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="flex gap-3">
                <Select value={filterProvider} onChange={e => { setFilterProvider(e.target.value); setPage(0); }} className="w-48">
                    <option value="">All Providers</option>
                    {["AWS", "AZURE", "GCP", "ALIBABA", "ORACLE_CLOUD", "IBM_CLOUD", "OTHER"].map(p => <option key={p} value={p}>{p}</option>)}
                </Select>
                <Select value={filterEnvironment} onChange={e => { setFilterEnvironment(e.target.value); setPage(0); }} className="w-40">
                    <option value="">All Environments</option>
                    {["PROD", "STAGING", "DEV"].map(e => <option key={e} value={e}>{e}</option>)}
                </Select>
            </div>

            <Card className="border-slate-200">
                <CardHeader className="pb-0">
                    <CardTitle className="text-base font-semibold text-slate-700">
                        {assets.length} asset{assets.length !== 1 ? "s" : ""}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="h-40 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <Cloud className="h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">No cloud assets found</h3>
                            <p className="text-slate-500 mt-1">Register your cloud resources to track costs and status.</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/50">
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Name</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Provider</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Region</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Environment</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Monthly Cost</th>
                                            <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                            <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assets.map((asset) => (
                                            <tr key={asset.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-slate-900">{asset.name}</div>
                                                    <div className="text-xs font-mono text-slate-400 truncate max-w-[180px]">{asset.resourceId}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${PROVIDER_COLORS[asset.provider] || "bg-slate-100 text-slate-500"}`}>
                                                        {asset.provider}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 text-xs">{asset.resourceType.replace("_", " ")}</td>
                                                <td className="py-3 px-4 text-slate-600">{asset.region}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${asset.environment === "PROD" ? "bg-red-100 text-red-700" : asset.environment === "STAGING" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                                                        {asset.environment}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-slate-700">
                                                    {asset.monthlyCostEstimate != null ? `${asset.currency || "USD"} ${asset.monthlyCostEstimate.toLocaleString()}` : "—"}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${STATUS_STYLES[asset.status] || STATUS_STYLES.UNKNOWN}`}>
                                                        {asset.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenCost(asset.id)} className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                                            Cost
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(asset)} className="h-7 px-2">
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(asset.id)} isLoading={deletingId === asset.id} className="h-7 px-2 text-red-600 hover:bg-red-50">
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
                                    <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
                                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Record Cost Modal */}
            <Modal isOpen={isCostModalOpen} onClose={() => setIsCostModalOpen(false)} title="Record Monthly Cost" description="Log a cost entry for this cloud asset.">
                <form onSubmit={costForm.handleSubmit(onSubmitCost)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="billingMonth">Billing Month <span className="text-red-500">*</span></Label>
                        <Input id="billingMonth" type="month" {...costForm.register("billingMonth", { required: true })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="costAmount">Amount <span className="text-red-500">*</span></Label>
                            <Input id="costAmount" type="number" step="0.01" {...costForm.register("amount", { required: true, valueAsNumber: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="serviceName">Service Name</Label>
                            <Input id="serviceName" placeholder="e.g. EC2 Compute" {...costForm.register("serviceName")} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsCostModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={costForm.formState.isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">Record Cost</Button>
                    </div>
                </form>
            </Modal>

            {/* Create/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAsset ? "Edit Cloud Asset" : "Add Cloud Asset"} description="Register a cloud resource.">
                <form onSubmit={assetForm.handleSubmit(onSubmitAsset)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="assetName">Name <span className="text-red-500">*</span></Label>
                        <Input id="assetName" placeholder="prod-web-server-01" {...assetForm.register("name", { required: true })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Provider <span className="text-red-500">*</span></Label>
                            <Select {...assetForm.register("provider")}>
                                {["AWS", "AZURE", "GCP", "ALIBABA", "ORACLE_CLOUD", "IBM_CLOUD", "OTHER"].map(p => <option key={p} value={p}>{p}</option>)}
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Environment <span className="text-red-500">*</span></Label>
                            <Select {...assetForm.register("environment")}>
                                {["PROD", "STAGING", "DEV"].map(e => <option key={e} value={e}>{e}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Resource Type</Label>
                            <Select {...assetForm.register("resourceType")}>
                                {["VIRTUAL_MACHINE", "STORAGE_BUCKET", "DATABASE", "LOAD_BALANCER", "CONTAINER", "SERVERLESS_FUNCTION", "KUBERNETES_CLUSTER", "NETWORK", "OTHER"].map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select {...assetForm.register("status")}>
                                {["RUNNING", "STOPPED", "TERMINATED", "PENDING", "UNKNOWN"].map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Region <span className="text-red-500">*</span></Label>
                            <Input placeholder="us-east-1" {...assetForm.register("region", { required: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Account ID</Label>
                            <Input placeholder="123456789012" {...assetForm.register("accountId")} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Resource ID <span className="text-red-500">*</span></Label>
                        <Input placeholder="arn:aws:ec2:..." {...assetForm.register("resourceId", { required: true })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Monthly Cost Estimate</Label>
                            <Input type="number" step="0.01" {...assetForm.register("monthlyCostEstimate", { valueAsNumber: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <Select {...assetForm.register("currency")}>
                                <option value="USD">USD</option>
                                <option value="GHS">GHS</option>
                                <option value="EUR">EUR</option>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Input placeholder="Optional description" {...assetForm.register("description")} />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={assetForm.formState.isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                            {editingAsset ? "Save Changes" : "Add Asset"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
