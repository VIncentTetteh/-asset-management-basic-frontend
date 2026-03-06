"use client";

import { useState, useEffect } from "react";
import { DepreciationPolicy, DepreciationPolicyDto } from "@/types";
import { depreciationPolicyService } from "@/services/depreciationPolicyService";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Calculator, Info, CalendarClock, DollarSign } from "lucide-react";
import { useForm } from "react-hook-form";

export default function DepreciationPoliciesPage() {
    const [policies, setPolicies] = useState<DepreciationPolicy[]>([]);
    const [orgId, setOrgId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<DepreciationPolicy | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DepreciationPolicyDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [policiesData, profileData] = await Promise.all([
                depreciationPolicyService.getAll(),
                authService.getProfile(),
            ]);
            setPolicies(policiesData);
            setOrgId((profileData as any).organisationId || "");
        } catch (error) {
            toast.error("Failed to load depreciation policies");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenCreate = () => {
        setEditingPolicy(null);
        reset({
            name: "",
            method: "STRAIGHT_LINE",
            usefulLifeMonths: 36, // default 3 years
            salvageValuePercent: 0,
            description: "",
            organisationId: orgId
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (policy: DepreciationPolicy) => {
        setEditingPolicy(policy);
        reset({
            name: policy.name,
            method: policy.method,
            usefulLifeMonths: policy.usefulLifeMonths || 36,
            salvageValuePercent: policy.salvageValuePercent || 0,
            description: policy.description || "",
            organisationId: policy.organisationId || orgId
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this policy? Assets using it may be affected.")) return;
        try {
            await depreciationPolicyService.delete(id);
            toast.success("Depreciation policy deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete policy");
            console.error(error);
        }
    };

    const onSubmit = async (data: DepreciationPolicyDto) => {
        try {
            data.usefulLifeMonths = Number(data.usefulLifeMonths);
            data.salvageValuePercent = Number(data.salvageValuePercent);

            if (!data.organisationId) data.organisationId = orgId;

            // Clean empty strings
            (Object.keys(data) as (keyof DepreciationPolicyDto)[]).forEach(k => {
                if (data[k] === "" && k !== 'name' && k !== 'method' && k !== 'organisationId') {
                    delete (data as any)[k];
                }
            });

            if (editingPolicy) {
                await depreciationPolicyService.update(editingPolicy.id!, data);
                toast.success("Depreciation policy updated");
            } else {
                await depreciationPolicyService.create(data);
                toast.success("Depreciation policy created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to save depreciation policy");
            console.error(error);
        }
    };

    const getMethodDisplay = (method: string) => {
        switch (method) {
            case "STRAIGHT_LINE": return "Straight Line";
            case "DECLINING_BALANCE": return "Declining Balance";
            case "SUM_OF_YEARS_DIGITS": return "Sum of Years Digits";
            default: return method;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Depreciation Policies</h1>
                    <p className="text-slate-500">Manage rules for asset value depreciation over time.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="mr-2 h-4 w-4" /> Create Policy
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : policies.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <Calculator className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No depreciation policies</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">Create policies to automatically track the reduced valuation of your capital assets over their useful lifecycle.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300">
                            Create Policy
                        </Button>
                    </div>
                ) : (
                    policies.map((policy) => (
                        <Card key={policy.id} className="overflow-hidden hover:shadow-md transition-all group border-slate-200 flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="truncate pr-2 w-full">
                                    <CardTitle className="text-base font-semibold text-slate-900 truncate" title={policy.name}>
                                        {policy.name}
                                    </CardTitle>
                                    <div className="font-medium text-xs text-indigo-700 mt-1 bg-indigo-50 px-2 py-0.5 rounded-full inline-block border border-indigo-100">
                                        {getMethodDisplay(policy.method || "")}
                                    </div>
                                </div>
                                <div className="p-2 bg-slate-100 text-slate-500 rounded-lg shrink-0">
                                    <Calculator className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col">
                                <div className="space-y-3 text-sm text-slate-600 flex-1">
                                    {policy.description && (
                                        <p className="line-clamp-2" title={policy.description}>{policy.description}</p>
                                    )}

                                    <div className="space-y-2 mt-4 pt-3 border-t border-slate-100">
                                        {policy.usefulLifeMonths && (
                                            <div className="flex justify-between items-center text-slate-700">
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <CalendarClock className="h-4 w-4" />
                                                    <span>Useful Life</span>
                                                </div>
                                                <span className="font-semibold">{policy.usefulLifeMonths} <span className="text-xs font-normal text-slate-400">mos</span></span>
                                            </div>
                                        )}
                                        {policy.salvageValuePercent !== undefined && (
                                            <div className="flex justify-between items-center text-slate-700">
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <DollarSign className="h-4 w-4" />
                                                    <span>Residual Value</span>
                                                </div>
                                                <span className="font-semibold">{policy.salvageValuePercent}%</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(policy)} className="h-8 w-8 p-0">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(policy.id!)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
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
                title={editingPolicy ? "Edit Depreciation Policy" : "Create Depreciation Policy"}
                description={editingPolicy ? "Update the depreciation policy rules." : "Define a new rule for calculating asset value over time."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <input type="hidden" {...register("organisationId")} value={editingPolicy ? (editingPolicy.organisationId || orgId) : orgId} />

                    <div className="space-y-2 relative">
                        <Label htmlFor="name">Policy Name <span className="text-red-500">*</span></Label>
                        <Input id="name" placeholder="e.g. Standard IT Hardware (3 Yrs)" {...register("name", { required: "Name is required" })} />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="method">Depreciation Method <span className="text-red-500">*</span></Label>
                        <Select id="method" {...register("method", { required: "Method is required" })}>
                            <option value="STRAIGHT_LINE">Straight Line</option>
                            <option value="DECLINING_BALANCE">Declining Balance</option>
                            <option value="SUM_OF_YEARS_DIGITS">Sum of Years Digits</option>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="usefulLifeMonths">Useful Life (Months)</Label>
                            <Input id="usefulLifeMonths" type="number" min="1" {...register("usefulLifeMonths")} />
                            <p className="text-[10px] text-slate-500 mt-1">Expected lifespan of the asset.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="salvageValuePercent">Residual Value (%)</Label>
                            <Input id="salvageValuePercent" type="number" step="0.01" min="0" max="100" {...register("salvageValuePercent")} />
                            <p className="text-[10px] text-slate-500 mt-1">Salvage value at end of life.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description & Use Cases</Label>
                        <Input id="description" placeholder="Applies to laptops and mobile phones..." {...register("description")} />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
                            {editingPolicy ? "Save Changes" : "Create Policy"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
