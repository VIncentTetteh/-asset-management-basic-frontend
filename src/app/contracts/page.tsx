"use client";

import { useState, useEffect } from "react";
import { Contract, ContractDto, Supplier } from "@/types";
import { contractService } from "@/services/contractService";
import { supplierService } from "@/services/supplierService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageSpinner } from "@/components/ui/spinner";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, FileSignature, AlertTriangle, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";


type TabType = "all" | "expiring";

export default function ContractsPage() {
    const [allContracts, setAllContracts] = useState<Contract[]>([]);
    const [displayedContracts, setDisplayedContracts] = useState<Contract[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>("all");
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | null>(null);
    const { confirm, ConfirmDialog } = useConfirm();

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContractDto>();

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const [contracts, suppliersData] = await Promise.allSettled([
                contractService.getAll(),
                supplierService.getAll(),
            ]);
            if (contracts.status === "fulfilled") {
                setAllContracts(contracts.value);
                setDisplayedContracts(contracts.value);
            }
            if (suppliersData.status === "fulfilled") setSuppliers(suppliersData.value);
        } catch {
            toast.error("Failed to load contracts");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleTabChange = async (tab: TabType) => {
        setActiveTab(tab);
        setIsLoading(true);
        try {
            if (tab === "all") {
                setDisplayedContracts(allContracts);
            } else {
                const data = await contractService.getExpiringSoon(30);
                setDisplayedContracts(data);
            }
        } catch {
            toast.error("Failed to load contracts");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingContract(null);
        reset({ title: "", contractType: "MAINTENANCE", status: "DRAFT", value: 0, currency: "USD", autoRenew: false });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (contract: Contract) => {
        setEditingContract(contract);
        reset({
            title: contract.title,
            contractType: contract.contractType,
            status: contract.status,
            supplierId: contract.supplierId || "",
            startDate: contract.startDate || "",
            endDate: contract.endDate || "",
            value: contract.value,
            currency: contract.currency || "USD",
            autoRenew: contract.autoRenew,
            terms: contract.terms || "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ message: "Delete this contract?", variant: "danger" })) return;
        setDeletingId(id);
        try {
            await contractService.delete(id);
            toast.success("Contract deleted");
            fetchAll();
        } catch {
            toast.error("Failed to delete contract");
        } finally {
            setDeletingId(null);
        }
    };

    const onSubmit = async (data: ContractDto) => {
        const payload = { ...data };
        (Object.keys(payload) as (keyof ContractDto)[]).forEach((k) => {
            if (payload[k] === "") delete (payload as Partial<ContractDto>)[k];
        });
        try {
            if (editingContract) {
                const patch = buildPatchPayload<ContractDto>(editingContract as unknown as Partial<ContractDto>, payload);
                if (Object.keys(patch).length === 0) { toast("No changes"); return; }
                await contractService.update(editingContract.id, patch);
                toast.success("Contract updated");
            } else {
                await contractService.create(payload);
                toast.success("Contract created");
            }
            setIsModalOpen(false);
            fetchAll();
        } catch {
            toast.error("Failed to save contract");
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case "ACTIVE": return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case "EXPIRING_SOON": return "bg-amber-100 text-amber-700 border-amber-200";
            case "EXPIRED": return "bg-red-100 text-red-700 border-red-200";
            case "TERMINATED": return "bg-slate-100 text-slate-500 border-slate-200";
            case "DRAFT": return "bg-sky-100 text-sky-700 border-sky-200";
            case "RENEWED": return "bg-purple-100 text-purple-700 border-purple-200";
            default: return "bg-slate-100 text-slate-500 border-slate-200";
        }
    };

    const isExpiringSoon = (endDate?: string | null) => {
        if (!endDate) return false;
        const diff = new Date(endDate).getTime() - Date.now();
        return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
    };

    const supplierName = (id?: string | null) => suppliers.find(s => s.id === id)?.name || "—";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Contracts</h1>
                    <p className="text-slate-500">Manage vendor and service contracts.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Contract
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-slate-200">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg"><FileSignature className="h-5 w-5 text-blue-600" /></div>
                        <div>
                            <p className="text-xs text-slate-500">Total Contracts</p>
                            <p className="text-xl font-bold text-slate-900">{allContracts.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg"><FileSignature className="h-5 w-5 text-emerald-600" /></div>
                        <div>
                            <p className="text-xs text-slate-500">Active</p>
                            <p className="text-xl font-bold text-slate-900">{allContracts.filter(c => c.status === "ACTIVE").length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                        <div>
                            <p className="text-xs text-slate-500">Expiring (30 days)</p>
                            <p className="text-xl font-bold text-slate-900">{allContracts.filter(c => isExpiringSoon(c.endDate)).length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex gap-2 border-b border-slate-200">
                {(["all", "expiring"] as TabType[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-purple-600 text-purple-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                    >
                        {tab === "all" ? "All Contracts" : "Expiring Soon"}
                    </button>
                ))}
            </div>

            <Card className="border-slate-200">
                <CardHeader className="pb-0">
                    <CardTitle className="text-base font-semibold text-slate-700">
                        {displayedContracts.length} contract{displayedContracts.length !== 1 ? "s" : ""}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="h-40 flex items-center justify-center">
                            <PageSpinner />
                        </div>
                    ) : displayedContracts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <FileSignature className="h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">No contracts found</h3>
                            <p className="text-slate-500 mt-1">Add contracts to track vendor agreements and renewals.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Title</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Supplier</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Start</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">End</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Value</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Auto-Renew</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                        <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedContracts.map((c) => {
                                        const expiring = isExpiringSoon(c.endDate);
                                        return (
                                            <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 px-4 font-medium text-slate-900">{c.title}</td>
                                                <td className="py-3 px-4 text-slate-600 text-xs">{c.contractType.replace("_", " ")}</td>
                                                <td className="py-3 px-4 text-slate-600">{supplierName(c.supplierId)}</td>
                                                <td className="py-3 px-4 text-slate-600">{c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"}</td>
                                                <td className="py-3 px-4">
                                                    <div className={`flex items-center gap-1 ${expiring ? "text-amber-600 font-medium" : "text-slate-600"}`}>
                                                        {expiring && <AlertTriangle className="h-3.5 w-3.5" />}
                                                        {c.endDate ? new Date(c.endDate).toLocaleDateString() : "—"}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-slate-700">
                                                    {c.currency || "USD"} {c.value.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {c.autoRenew ? (
                                                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                                                            <RefreshCw className="h-3 w-3" /> Yes
                                                        </span>
                                                    ) : <span className="text-slate-400 text-xs">No</span>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${getStatusStyles(c.status)}`}>
                                                        {c.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(c)} className="h-7 px-2">
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} isLoading={deletingId === c.id} className="h-7 px-2 text-red-600 hover:bg-red-50">
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingContract ? "Edit Contract" : "Add Contract"}
                description={editingContract ? "Update contract details." : "Register a new contract."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                        <Input id="title" placeholder="e.g. Dell Hardware Support Agreement" {...register("title", { required: "Title is required" })} />
                        {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="contractType">Type</Label>
                            <Select id="contractType" {...register("contractType")}>
                                {["PURCHASE", "LEASE", "MAINTENANCE", "SERVICE_LEVEL_AGREEMENT", "WARRANTY", "INSURANCE", "OTHER"].map(t => (
                                    <option key={t} value={t}>{t.replace("_", " ")}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select id="status" {...register("status")}>
                                {["DRAFT", "ACTIVE", "EXPIRING_SOON", "EXPIRED", "TERMINATED", "RENEWED"].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="supplierId">Supplier</Label>
                        <Select id="supplierId" {...register("supplierId")}>
                            <option value="">— None —</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Start Date <span className="text-red-500">*</span></Label>
                            <Input id="startDate" type="date" {...register("startDate", { required: "Start date is required" })} />
                            {errors.startDate && <p className="text-sm text-red-500">{errors.startDate.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">End Date <span className="text-red-500">*</span></Label>
                            <Input id="endDate" type="date" {...register("endDate", { required: "End date is required" })} />
                            {errors.endDate && <p className="text-sm text-red-500">{errors.endDate.message}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="value">Contract Value <span className="text-red-500">*</span></Label>
                            <Input id="value" type="number" step="0.01" placeholder="0.00" {...register("value", { required: true, valueAsNumber: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Select id="currency" {...register("currency")}>
                                <option value="USD">USD</option>
                                <option value="GHS">GHS</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <input type="checkbox" id="autoRenew" {...register("autoRenew")} className="h-4 w-4 rounded border-slate-300 text-purple-600" />
                        <Label htmlFor="autoRenew">Auto-Renew</Label>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="terms">Terms</Label>
                        <textarea
                            id="terms"
                            rows={3}
                            placeholder="Contract terms and conditions..."
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            {...register("terms")}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                            {editingContract ? "Save Changes" : "Add Contract"}
                        </Button>
                    </div>
                </form>
        {ConfirmDialog}
            </Modal>
        </div>
    );
}
