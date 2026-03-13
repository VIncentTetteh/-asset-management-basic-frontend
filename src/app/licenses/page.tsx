"use client";

import { useState, useEffect } from "react";
import { SoftwareLicense, SoftwareLicenseDto, Supplier } from "@/types";
import { licenseService } from "@/services/licenseService";
import { supplierService } from "@/services/supplierService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Key, AlertTriangle, BarChart2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";

type TabType = "all" | "expiring" | "over-allocated";

export default function LicensesPage() {
    const [allLicenses, setAllLicenses] = useState<SoftwareLicense[]>([]);
    const [displayedLicenses, setDisplayedLicenses] = useState<SoftwareLicense[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>("all");
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLicense, setEditingLicense] = useState<SoftwareLicense | null>(null);
    const [utilization, setUtilization] = useState<{ totalSeats: number; totalAllocated: number; utilizationPct: number } | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SoftwareLicenseDto>();

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const [licenses, suppliersData, util] = await Promise.allSettled([
                licenseService.getAll(),
                supplierService.getAll(),
                licenseService.getUtilization(),
            ]);
            if (licenses.status === "fulfilled") {
                setAllLicenses(licenses.value);
                setDisplayedLicenses(licenses.value);
            }
            if (suppliersData.status === "fulfilled") setSuppliers(suppliersData.value);
            if (util.status === "fulfilled") setUtilization(util.value);
        } catch {
            toast.error("Failed to load licenses");
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
                setDisplayedLicenses(allLicenses);
            } else if (tab === "expiring") {
                const data = await licenseService.getExpiringSoon(30);
                setDisplayedLicenses(data);
            } else if (tab === "over-allocated") {
                const data = await licenseService.getOverAllocated();
                setDisplayedLicenses(data);
            }
        } catch {
            toast.error("Failed to load licenses");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingLicense(null);
        reset({ productName: "", licenseType: "SUBSCRIPTION", status: "ACTIVE", seats: 1, allocatedSeats: 0, currency: "USD" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (license: SoftwareLicense) => {
        setEditingLicense(license);
        reset({
            productName: license.productName,
            licenseType: license.licenseType,
            status: license.status,
            licenseKey: license.licenseKey || "",
            vendor: license.vendor || "",
            seats: license.seats,
            allocatedSeats: license.allocatedSeats,
            purchaseDate: license.purchaseDate || "",
            expiryDate: license.expiryDate || "",
            monthlyCost: license.monthlyCost ?? undefined,
            currency: license.currency || "USD",
            supplierId: license.supplierId || "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this license?")) return;
        setDeletingId(id);
        try {
            await licenseService.delete(id);
            toast.success("License deleted");
            fetchAll();
        } catch {
            toast.error("Failed to delete license");
        } finally {
            setDeletingId(null);
        }
    };

    const onSubmit = async (data: SoftwareLicenseDto) => {
        const payload = { ...data };
        (Object.keys(payload) as (keyof SoftwareLicenseDto)[]).forEach((k) => {
            if (payload[k] === "") delete (payload as Partial<SoftwareLicenseDto>)[k];
        });
        try {
            if (editingLicense) {
                const patch = buildPatchPayload<SoftwareLicenseDto>(editingLicense as unknown as Partial<SoftwareLicenseDto>, payload);
                if (Object.keys(patch).length === 0) { toast("No changes"); return; }
                await licenseService.update(editingLicense.id, patch);
                toast.success("License updated");
            } else {
                await licenseService.create(payload);
                toast.success("License created");
            }
            setIsModalOpen(false);
            fetchAll();
        } catch {
            toast.error("Failed to save license");
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case "ACTIVE": return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case "EXPIRING_SOON": return "bg-amber-100 text-amber-700 border-amber-200";
            case "EXPIRED": return "bg-red-100 text-red-700 border-red-200";
            case "SUSPENDED": return "bg-orange-100 text-orange-700 border-orange-200";
            case "CANCELLED": return "bg-slate-100 text-slate-500 border-slate-200";
            default: return "bg-slate-100 text-slate-500 border-slate-200";
        }
    };

    const getLicenseTypeStyles = (type: string) => {
        switch (type) {
            case "SUBSCRIPTION": return "bg-blue-100 text-blue-700";
            case "PERPETUAL": return "bg-slate-100 text-slate-700";
            case "VOLUME": return "bg-purple-100 text-purple-700";
            case "ENTERPRISE": return "bg-indigo-100 text-indigo-700";
            case "TRIAL": return "bg-yellow-100 text-yellow-700";
            default: return "bg-slate-100 text-slate-500";
        }
    };

    const isExpiringSoon = (expiryDate?: string | null) => {
        if (!expiryDate) return false;
        const diff = new Date(expiryDate).getTime() - Date.now();
        return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Software Licenses</h1>
                    <p className="text-slate-500">Track and manage your software license inventory.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="mr-2 h-4 w-4" /> Add License
                </Button>
            </div>

            {utilization && (
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-slate-200">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg"><Key className="h-5 w-5 text-blue-600" /></div>
                            <div>
                                <p className="text-xs text-slate-500">Total Licenses</p>
                                <p className="text-xl font-bold text-slate-900">{allLicenses.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-slate-200">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg"><BarChart2 className="h-5 w-5 text-emerald-600" /></div>
                            <div>
                                <p className="text-xs text-slate-500">Seat Utilization</p>
                                <p className="text-xl font-bold text-slate-900">{utilization.utilizationPct?.toFixed(1)}%</p>
                                <p className="text-xs text-slate-400">{utilization.totalAllocated} / {utilization.totalSeats} seats</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-slate-200">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
                            <div>
                                <p className="text-xs text-slate-500">Expiring (30 days)</p>
                                <p className="text-xl font-bold text-slate-900">
                                    {allLicenses.filter(l => isExpiringSoon(l.expiryDate)).length}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="flex gap-2 border-b border-slate-200">
                {(["all", "expiring", "over-allocated"] as TabType[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-purple-600 text-purple-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                    >
                        {tab === "all" ? "All Licenses" : tab === "expiring" ? "Expiring Soon" : "Over-Allocated"}
                    </button>
                ))}
            </div>

            <Card className="border-slate-200">
                <CardHeader className="pb-0">
                    <CardTitle className="text-base font-semibold text-slate-700">
                        {displayedLicenses.length} {activeTab === "all" ? "total" : activeTab === "expiring" ? "expiring soon" : "over-allocated"} license{displayedLicenses.length !== 1 ? "s" : ""}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="h-40 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                        </div>
                    ) : displayedLicenses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <Key className="h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">No licenses found</h3>
                            <p className="text-slate-500 mt-1">Add software licenses to track seat usage and expiry.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Product</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Seats</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Expiry</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Cost/mo</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                        <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedLicenses.map((lic) => {
                                        const overAllocated = lic.allocatedSeats > lic.seats;
                                        const expiring = isExpiringSoon(lic.expiryDate);
                                        return (
                                            <tr key={lic.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-slate-900">{lic.productName}</div>
                                                    {lic.vendor && <div className="text-xs text-slate-400">{lic.vendor}</div>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getLicenseTypeStyles(lic.licenseType)}`}>
                                                        {lic.licenseType}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className={`flex items-center gap-1 ${overAllocated ? "text-red-600" : "text-slate-700"}`}>
                                                        {overAllocated && <AlertTriangle className="h-3.5 w-3.5" />}
                                                        <span className="font-medium">{lic.allocatedSeats}</span>
                                                        <span className="text-slate-400">/ {lic.seats}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className={`flex items-center gap-1 ${expiring ? "text-amber-600" : "text-slate-600"}`}>
                                                        {expiring && <AlertTriangle className="h-3.5 w-3.5" />}
                                                        {lic.expiryDate ? new Date(lic.expiryDate).toLocaleDateString() : "—"}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-slate-700">
                                                    {lic.monthlyCost != null ? `${lic.currency || "USD"} ${lic.monthlyCost.toLocaleString()}` : "—"}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${getStatusStyles(lic.status)}`}>
                                                        {lic.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(lic)} className="h-7 px-2">
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(lic.id)} isLoading={deletingId === lic.id} className="h-7 px-2 text-red-600 hover:bg-red-50">
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
                title={editingLicense ? "Edit License" : "Add License"}
                description={editingLicense ? "Update license details." : "Register a new software license."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="productName">Product Name <span className="text-red-500">*</span></Label>
                        <Input id="productName" placeholder="e.g. Microsoft Office 365" {...register("productName", { required: "Product name is required" })} />
                        {errors.productName && <p className="text-sm text-red-500">{errors.productName.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="licenseType">License Type</Label>
                            <Select id="licenseType" {...register("licenseType")}>
                                {["SUBSCRIPTION", "PERPETUAL", "VOLUME", "NODE_LOCKED", "OPEN_SOURCE", "TRIAL", "ENTERPRISE", "OEM"].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select id="status" {...register("status")}>
                                {["ACTIVE", "EXPIRING_SOON", "EXPIRED", "SUSPENDED", "CANCELLED"].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="vendor">Vendor</Label>
                        <Input id="vendor" placeholder="e.g. Microsoft" {...register("vendor")} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="licenseKey">License Key</Label>
                        <Input id="licenseKey" placeholder="XXXXX-XXXXX-XXXXX" {...register("licenseKey")} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="seats">Total Seats <span className="text-red-500">*</span></Label>
                            <Input id="seats" type="number" min={1} {...register("seats", { required: true, valueAsNumber: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="allocatedSeats">Allocated Seats</Label>
                            <Input id="allocatedSeats" type="number" min={0} {...register("allocatedSeats", { valueAsNumber: true })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="purchaseDate">Purchase Date</Label>
                            <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="expiryDate">Expiry Date</Label>
                            <Input id="expiryDate" type="date" {...register("expiryDate")} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="monthlyCost">Monthly Cost</Label>
                            <Input id="monthlyCost" type="number" step="0.01" placeholder="0.00" {...register("monthlyCost", { valueAsNumber: true })} />
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

                    <div className="space-y-2">
                        <Label htmlFor="supplierId">Supplier</Label>
                        <Select id="supplierId" {...register("supplierId")}>
                            <option value="">— None —</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                            {editingLicense ? "Save Changes" : "Add License"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
