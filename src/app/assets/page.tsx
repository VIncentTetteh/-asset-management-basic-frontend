"use client";

import { useState, useEffect, useMemo } from "react";
import { Asset, AssetDto, Department, Organisation, AssetState } from "@/types";
import { assetService } from "@/services/assetService";
import { departmentService } from "@/services/departmentService";
import { organisationService } from "@/services/organisationService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Hexagon, Building2, Layers } from "lucide-react";
import { useForm } from "react-hook-form";

export default function AssetsPage() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

    const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<AssetDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [assetsData, deptsData, orgsData] = await Promise.all([
                assetService.getAll(),
                departmentService.getAll(),
                organisationService.getAll(),
            ]);
            setAssets(assetsData);
            setDepartments(deptsData);
            setOrganisations(orgsData);
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

    const orgMap = useMemo(() => {
        const map = new Map<string, string>();
        organisations.forEach(org => map.set(org.id, org.name));
        return map;
    }, [organisations]);

    const deptMap = useMemo(() => {
        const map = new Map<string, string>();
        departments.forEach(dept => map.set(dept.id, dept.name));
        return map;
    }, [departments]);

    const handleOpenCreate = () => {
        setEditingAsset(null);
        reset({
            name: "",
            category: "",
            purchaseCost: 0,
            usefulLifeInYears: 1,
            state: AssetState.REGISTERED,
            departmentId: "",
            organisationId: ""
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (asset: Asset) => {
        setEditingAsset(asset);
        reset({
            name: asset.name,
            category: asset.category,
            purchaseCost: asset.purchaseCost,
            usefulLifeInYears: asset.usefulLifeInYears,
            state: asset.state,
            departmentId: asset.departmentId || "",
            organisationId: asset.organisationId || ""
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
        // Normalize departmentId for comparison (treat undefined/null as empty string)
        const targetDeptId = data.departmentId || "";

        const isDuplicate = assets.some(
            asset => {
                const assetDeptId = asset.departmentId || "";
                return asset.name.toLowerCase() === data.name.toLowerCase() &&
                    assetDeptId === targetDeptId &&
                    asset.id !== editingAsset?.id;
            }
        );

        if (isDuplicate) {
            const deptName = targetDeptId ? deptMap.get(targetDeptId) : "no department";
            toast.error(`Asset "${data.name}" already exists in ${deptName ? deptName : "this department"}.`);
            return;
        }

        try {
            // Ensure numbers are numbers
            data.purchaseCost = Number(data.purchaseCost);
            data.usefulLifeInYears = Number(data.usefulLifeInYears);

            // Cleanup empty strings
            if (!data.departmentId) delete data.departmentId;
            if (!data.organisationId) delete data.organisationId;

            if (editingAsset) {
                await assetService.update(editingAsset.id, data);

                // Handle assignment if department changed or added
                if (data.departmentId && data.departmentId !== editingAsset.departmentId) {
                    await assetService.assignToDepartment(editingAsset.id, data.departmentId);
                }

                toast.success("Asset updated");
            } else {
                const created = await assetService.create(data);
                if (data.departmentId) {
                    await assetService.assignToDepartment(created.id!, data.departmentId);
                }
                toast.success("Asset created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to save asset");
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Assets</h1>
                    <p className="text-slate-500">Track and manage your organizational assets.</p>
                </div>
                <Button onClick={handleOpenCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add Asset
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <p>Loading...</p>
                ) : assets.length === 0 ? (
                    <p className="text-slate-500 col-span-full text-center py-10">No assets found. Create one to get started.</p>
                ) : (
                    assets.map((asset) => (
                        <Card key={asset.id}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg font-medium">{asset.name}</CardTitle>
                                        <CardDescription>{asset.category}</CardDescription>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs font-semibold ${asset.state === AssetState.REGISTERED ? 'bg-blue-100 text-blue-700' :
                                        asset.state === AssetState.ASSIGNED ? 'bg-green-100 text-green-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                        {asset.state}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm text-slate-600 mb-4">
                                    <div className="flex justify-between">
                                        <span>Cost:</span>
                                        <span className="font-medium">${asset.purchaseCost}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Useful Life:</span>
                                        <span className="font-medium">{asset.usefulLifeInYears} years</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Org:</span>
                                        <span className="font-medium">{orgMap.get(asset.organisationId || "") || "-"}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> Dept:</span>
                                        <span className="font-medium">{deptMap.get(asset.departmentId || "") || "-"}</span>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(asset)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(asset.id)}>
                                        <Trash2 className="h-4 w-4" />
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
                title={editingAsset ? "Edit Asset" : "Create Asset"}
                description={editingAsset ? "Update asset details." : "Register a new asset."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. MacBook Pro"
                            {...register("name", { required: "Name is required" })}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Input
                                id="category"
                                placeholder="e.g. IT Equipment"
                                {...register("category", { required: "Category is required" })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="purchaseCost">Cost</Label>
                            <Input
                                id="purchaseCost"
                                type="number"
                                min="0"
                                step="0.01"
                                {...register("purchaseCost", { required: "Cost is required", min: 0 })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="usefulLifeInYears">Useful Life (Years)</Label>
                            <Input
                                id="usefulLifeInYears"
                                type="number"
                                min="1"
                                {...register("usefulLifeInYears", { required: "Required", min: 1 })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="state">State</Label>
                            <Select id="state" {...register("state")}>
                                {Object.values(AssetState).map((state) => (
                                    <option key={state} value={state}>{state}</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="organisationId">Organisation</Label>
                        <Select id="organisationId" {...register("organisationId")}>
                            <option value="">None</option>
                            {organisations.map((org) => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="departmentId">Department</Label>
                        <Select
                            id="departmentId"
                            {...register("departmentId")}
                            disabled={watch("state") !== AssetState.REGISTERED}
                        >
                            <option value="">None</option>
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </Select>
                        {watch("state") !== AssetState.REGISTERED ? (
                            <p className="text-xs text-amber-600">Only REGISTERED assets can be assigned to a department.</p>
                        ) : (
                            <p className="text-xs text-slate-500">Assigning to a department may auto-update organisation.</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting}>
                            {editingAsset ? "Save Changes" : "Create Asset"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
