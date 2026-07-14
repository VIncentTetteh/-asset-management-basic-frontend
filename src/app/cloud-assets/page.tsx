"use client";

import { useState, useEffect } from "react";
import { CloudAsset, CloudAssetDto, CloudCostSummary, CloudMonthlyCostDto } from "@/types";
import { cloudAssetService } from "@/services/cloudAssetService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Cloud, DollarSign, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";

const PROVIDER_COLORS: Record<string, string> = {
    AWS: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    AZURE: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    GCP: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    ALIBABA: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    ORACLE_CLOUD: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
    IBM_CLOUD: "bg-surface-muted text-muted-fg",
    OTHER: "bg-surface-muted text-faint-fg",
};

const STATUS_STYLES: Record<string, string> = {
    RUNNING: "bg-ok-soft text-ok border-ok/30",
    STOPPED: "bg-warn-soft text-warn border-warn/30",
    TERMINATED: "bg-surface-muted text-faint-fg border-edge-subtle",
    PENDING: "bg-info-soft text-info border-info/30",
    UNKNOWN: "bg-surface-muted text-faint-fg border-edge-subtle",
};

const ENV_STYLES: Record<string, string> = {
    PROD: "bg-danger-soft text-danger",
    STAGING: "bg-warn-soft text-warn",
    DEV: "bg-info-soft text-info",
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
    const [isSyncing, setIsSyncing] = useState(false);

    const assetForm = useForm<CloudAssetDto>();
    const costForm = useForm<CloudMonthlyCostDto>();
    const { confirm, ConfirmDialog } = useConfirm();

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
                const data = assetsResult.value;
                setAssets(data.items ?? data.content ?? []);
                setTotalPages(data.totalPages ?? Math.ceil((data.total ?? 0) / (data.limit || 20)));
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
        assetForm.reset({ name: "", provider: "AWS", region: "", resourceId: "", resourceType: "VIRTUAL_MACHINE", status: "RUNNING", environment: "PROD", currency: "GHS" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (asset: CloudAsset) => {
        setEditingAsset(asset);
        assetForm.reset({
            name: asset.name, provider: asset.provider, region: asset.region,
            resourceId: asset.resourceId, resourceType: asset.resourceType,
            status: asset.status, accountId: asset.accountId || "",
            monthlyCostEstimate: asset.monthlyCostEstimate ?? undefined,
            currency: asset.currency || "GHS", environment: asset.environment,
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
        if (!await confirm({ message: "Delete this cloud asset?", variant: "danger" })) return;
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

    const handleSyncAll = async () => {
        setIsSyncing(true);
        try {
            const res = await cloudAssetService.syncAll();
            toast.success(res.message || `Sync complete. ${res.assetsUpserted} assets updated.`);
            fetchAll(page);
        } catch {
            toast.error("Failed to sync cloud assets");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Cloud Assets"
                subtitle="Track and manage your cloud infrastructure resources."
                actions={<>
                    <Button onClick={handleSyncAll} variant="outline" isLoading={isSyncing}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Sync Hub
                    </Button>
                    <Button onClick={handleOpenCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Add Cloud Asset
                    </Button>
                </>}
            />

            {costSummary && (
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="md:col-span-1">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="rounded-control bg-brand-soft p-2"><DollarSign className="h-5 w-5 text-brand" /></div>
                            <div>
                                <p className="text-xs text-faint-fg">Total Monthly Cost</p>
                                <p className="data-mono text-xl font-bold text-foreground">{costSummary.currency} {costSummary.totalMonthlyCost.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="md:col-span-1">
                        <CardHeader className="px-4 pb-1 pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-faint-fg">By Provider</p></CardHeader>
                        <CardContent className="space-y-1 px-4 pb-3">
                            {Object.entries(costSummary.costByProvider || {}).map(([p, v]) => (
                                <div key={p} className="flex justify-between text-sm">
                                    <span className={cn("rounded px-2 py-0.5 text-xs font-medium", PROVIDER_COLORS[p] || "bg-surface-muted text-faint-fg")}>{p}</span>
                                    <span className="data-mono font-medium text-muted-fg">{costSummary.currency} {v.toLocaleString()}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Card className="md:col-span-1">
                        <CardHeader className="px-4 pb-1 pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-faint-fg">By Environment</p></CardHeader>
                        <CardContent className="space-y-1 px-4 pb-3">
                            {Object.entries(costSummary.costByEnvironment || {}).map(([e, v]) => (
                                <div key={e} className="flex justify-between text-sm">
                                    <span className="text-muted-fg">{e}</span>
                                    <span className="data-mono font-medium text-muted-fg">{costSummary.currency} {v.toLocaleString()}</span>
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

            <Card>
                <CardHeader className="pb-0">
                    <CardTitle className="text-base font-semibold text-foreground">
                        {assets.length} asset{assets.length !== 1 ? "s" : ""}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex h-40 items-center justify-center">
                            <PageSpinner />
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <Cloud className="mb-4 h-12 w-12 text-faint-fg" />
                            <h3 className="text-lg font-medium text-foreground">No cloud assets found</h3>
                            <p className="mt-1 text-muted-fg">Register your cloud resources to track costs and status.</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-edge-subtle bg-surface-muted/50">
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Name</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Provider</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Type</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Region</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Environment</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Monthly Cost</th>
                                            <th className="px-4 py-3 text-left font-medium text-muted-fg">Status</th>
                                            <th className="px-4 py-3 text-right font-medium text-muted-fg">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assets.map((asset) => (
                                            <tr key={asset.id} className="border-b border-edge-subtle transition-colors hover:bg-surface-muted/50">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-foreground">{asset.name}</div>
                                                    <div className="data-mono max-w-[180px] truncate text-xs text-faint-fg">{asset.resourceId}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={cn("rounded px-2 py-0.5 text-xs font-medium", PROVIDER_COLORS[asset.provider] || "bg-surface-muted text-faint-fg")}>
                                                        {asset.provider}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-fg">{asset.resourceType.replace("_", " ")}</td>
                                                <td className="px-4 py-3 text-muted-fg">{asset.region}</td>
                                                <td className="px-4 py-3">
                                                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ENV_STYLES[asset.environment] || "bg-info-soft text-info")}>
                                                        {asset.environment}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-muted-fg">
                                                    {asset.monthlyCostEstimate != null ? `${asset.currency || "GHS"} ${asset.monthlyCostEstimate.toLocaleString()}` : "—"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", STATUS_STYLES[asset.status] || STATUS_STYLES.UNKNOWN)}>
                                                        {asset.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenCost(asset.id)} className="h-7 border-ok/30 px-2 text-xs text-ok hover:bg-ok-soft">
                                                            Cost
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(asset)} className="h-7 px-2">
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(asset.id)} isLoading={deletingId === asset.id} className="h-7 px-2 text-danger hover:bg-danger-soft">
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
                                <div className="flex items-center justify-between border-t border-edge-subtle px-4 py-3">
                                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
                                    <span className="text-sm text-muted-fg">Page {page + 1} of {totalPages}</span>
                                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <Modal isOpen={isCostModalOpen} onClose={() => setIsCostModalOpen(false)} title="Record Monthly Cost" description="Log a cost entry for this cloud asset.">
                <form onSubmit={costForm.handleSubmit(onSubmitCost)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="billingMonth">Billing Month <span className="text-danger">*</span></Label>
                        <Input id="billingMonth" type="month" {...costForm.register("billingMonth", { required: true })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="costAmount">Amount <span className="text-danger">*</span></Label>
                            <Input id="costAmount" type="number" step="0.01" {...costForm.register("amount", { required: true, valueAsNumber: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="serviceName">Service Name</Label>
                            <Input id="serviceName" placeholder="e.g. EC2 Compute" {...costForm.register("serviceName")} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsCostModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={costForm.formState.isSubmitting}>Record Cost</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAsset ? "Edit Cloud Asset" : "Add Cloud Asset"} description="Register a cloud resource.">
                <form onSubmit={assetForm.handleSubmit(onSubmitAsset)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="assetName">Name <span className="text-danger">*</span></Label>
                        <Input id="assetName" placeholder="prod-web-server-01" {...assetForm.register("name", { required: true })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Provider <span className="text-danger">*</span></Label>
                            <Select {...assetForm.register("provider")}>
                                {["AWS", "AZURE", "GCP", "ALIBABA", "ORACLE_CLOUD", "IBM_CLOUD", "OTHER"].map(p => <option key={p} value={p}>{p}</option>)}
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Environment <span className="text-danger">*</span></Label>
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
                            <Label>Region <span className="text-danger">*</span></Label>
                            <Input placeholder="us-east-1" {...assetForm.register("region", { required: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Account ID</Label>
                            <Input placeholder="123456789012" {...assetForm.register("accountId")} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Resource ID <span className="text-danger">*</span></Label>
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
                        <Textarea placeholder="Optional description" {...assetForm.register("description")} />
                    </div>
                    <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={assetForm.formState.isSubmitting}>
                            {editingAsset ? "Save Changes" : "Add Asset"}
                        </Button>
                    </div>
                </form>
            </Modal>
            {ConfirmDialog}
        </div>
    );
}
