"use client";

import { useState, useEffect, useMemo } from "react";
import { Department, DepartmentDto } from "@/types";
import { departmentService } from "@/services/departmentService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CardSkeleton } from "@/components/ui/skeleton";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Layers, DollarSign, Users, Building, AlertCircle, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const { format, symbol } = useCurrency();

    const filteredDepts = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return departments;
        return departments.filter(d =>
            d.name.toLowerCase().includes(q) ||
            d.departmentCode?.toLowerCase().includes(q) ||
            d.costCenterCode?.toLowerCase().includes(q)
        );
    }, [departments, searchTerm]);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DepartmentDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const deptsData = await departmentService.getAll();
            setDepartments(deptsData);
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

    const handleOpenCreate = () => {
        setEditingDept(null);
        reset({
            name: "",
            departmentCode: "",
            costCenterCode: "",
            budgetLimit: undefined,
            status: "ACTIVE"
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (dept: Department) => {
        setEditingDept(dept);
        reset({
            name: dept.name,
            departmentCode: dept.departmentCode || "",
            costCenterCode: dept.costCenterCode || "",
            budgetLimit: dept.budgetLimit,
            status: dept.status || "ACTIVE",
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        setDeleteTargetId(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;
        setDeletingId(deleteTargetId);
        setIsDeleteModalOpen(false);
        try {
            await departmentService.delete(deleteTargetId);
            toast.success("Department deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete department");
            console.error(error);
        } finally {
            setDeletingId(null);
            setDeleteTargetId(null);
        }
    };

    const onSubmit = async (data: DepartmentDto) => {
        const otherdepts = departments.filter(dept => dept.id !== editingDept?.id);

        const duplicateName = otherdepts.find(dept => dept.name.toLowerCase() === data.name.toLowerCase());
        if (duplicateName) {
            toast.error(`A department named "${data.name}" already exists.`);
            return;
        }

        const duplicateCode = data.departmentCode && otherdepts.find(
            dept => dept.departmentCode?.toLowerCase() === data.departmentCode!.toLowerCase()
        );
        if (duplicateCode) {
            toast.error(`Department code "${data.departmentCode}" is already used by "${duplicateCode.name}".`);
            return;
        }

        const duplicateCostCenter = data.costCenterCode && otherdepts.find(
            dept => dept.costCenterCode?.toLowerCase() === data.costCenterCode!.toLowerCase()
        );
        if (duplicateCostCenter) {
            toast.error(`Cost center code "${data.costCenterCode}" is already used by "${duplicateCostCenter.name}".`);
            return;
        }

        const payload: DepartmentDto = { ...data };
        delete payload.description;

        // Clean empty optional properties
        if (!payload.departmentCode) delete payload.departmentCode;
        if (!payload.costCenterCode) delete payload.costCenterCode;
        if (payload.budgetLimit) payload.budgetLimit = Number(payload.budgetLimit);

        try {
            if (editingDept) {
                const prevForPatch: Partial<DepartmentDto> = {
                    ...(editingDept as unknown as Partial<DepartmentDto>),
                };
                delete prevForPatch.description;
                const patch = buildPatchPayload<DepartmentDto>(prevForPatch, payload);
                if (Object.keys(patch).length === 0) {
                    toast("No changes to update");
                    return;
                }
                await departmentService.update(editingDept.id!, patch);
                toast.success("Department updated");
            } else {
                await departmentService.create(payload);
                toast.success("Department created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error: any) {
            const status = error?.response?.status ?? error?.status;
            if (status === 409) {
                toast.error("A department with that name, code, or cost center already exists.");
            } else {
                toast.error("Failed to save department");
            }
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Departments</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Manage organizational departments, cost centers, and hierarchies.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search departments…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-8 h-9 w-52 text-sm"
                        />
                    </div>
                    <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
                        <Plus className="mr-2 h-4 w-4" /> Add Department
                    </Button>
                </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
                ) : filteredDepts.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <Layers className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">
                            {searchTerm ? "No matching departments" : "No departments found"}
                        </h3>
                        <p className="text-slate-500 mt-1 max-w-sm">
                            {searchTerm ? `No departments match "${searchTerm}".` : "Create departments to organize your assets and users logically."}
                        </p>
                        {!searchTerm && (
                            <Button onClick={handleOpenCreate} className="mt-6 bg-indigo-600 hover:bg-indigo-700">
                                Add Department
                            </Button>
                        )}
                    </div>
                ) : (
                    filteredDepts.map((dept) => (
                        <Card key={dept.id} className="overflow-hidden hover:shadow-md transition-all flex flex-col h-full border-slate-200">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
                                        <Layers className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 pr-2">
                                        <CardTitle className="text-base font-semibold text-slate-900 truncate" title={dept.name}>
                                            {dept.name}
                                        </CardTitle>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            {dept.departmentCode && (
                                                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                    {dept.departmentCode}
                                                </span>
                                            )}
                                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full border uppercase ${dept.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                                "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                                {dept.status || "ACTIVE"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 flex flex-col">
                                <div className="p-4 space-y-4 flex-1">
                                    <div className="space-y-3 pt-3 border-t border-slate-100">
                                        {/* Hierarchy / Manager */}
                                        {(dept.parentDepartmentId || dept.managerId) && (
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hierarchy & Contact</h4>
                                                {dept.parentDepartmentId && (
                                                    <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-1.5 rounded-md border border-slate-100">
                                                        <Building className="h-4 w-4 text-slate-400 shrink-0" />
                                                        <span className="truncate">Sub-department</span>
                                                    </div>
                                                )}
                                                {dept.managerId && (
                                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                                        <Users className="h-4 w-4 text-indigo-400 shrink-0" />
                                                        <span className="truncate">Manager Assigned</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Financials */}
                                        {(dept.costCenterCode || dept.budgetLimit !== undefined) && (
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Financial Setup</h4>
                                                {dept.costCenterCode && (
                                                    <div className="flex justify-between items-center text-sm text-slate-600">
                                                        <span>Cost Center</span>
                                                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded border">{dept.costCenterCode}</span>
                                                    </div>
                                                )}
                                                {dept.budgetLimit !== undefined && (
                                                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                                        <DollarSign className="h-4 w-4 text-emerald-500 shrink-0" />
                                                        <span className="font-medium text-slate-800">{format(dept.budgetLimit)}</span>
                                                        <span className="text-xs text-slate-400">budget</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Fallback Empty Details State */}
                                    {!dept.parentDepartmentId && !dept.managerId && !dept.costCenterCode && dept.budgetLimit === undefined && (
                                        <div className="flex flex-col items-center justify-center opacity-50 py-2">
                                            <AlertCircle className="h-5 w-5 text-slate-300 mb-1" />
                                            <span className="text-[10px] text-slate-400 font-medium">BASIC RECORD</span>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 bg-slate-50/50 mt-auto border-t border-slate-100 flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(dept)} className="h-8">
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(dept.id!)} isLoading={deletingId === dept.id} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => { setIsDeleteModalOpen(false); setDeleteTargetId(null); }}
                title="Delete Department"
                description="This action cannot be undone. The department will be permanently removed."
            >
                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => { setIsDeleteModalOpen(false); setDeleteTargetId(null); }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        isLoading={!!deletingId}
                        onClick={confirmDelete}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        Delete
                    </Button>
                </div>
            </Modal>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingDept ? "Edit Department" : "Create Department"}
                description={editingDept ? "Update department details." : "Add a new department."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
                            <Input
                                id="name"
                                placeholder="e.g. Engineering"
                                {...register("name", { required: "Name is required" })}
                            />
                            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="departmentCode">Department Code</Label>
                            <Input id="departmentCode" placeholder="ENG-001" {...register("departmentCode")} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="costCenterCode">Cost Center Code</Label>
                            <Input id="costCenterCode" placeholder="CC-001" {...register("costCenterCode")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="budgetLimit">Budget Limit ({symbol})</Label>
                            <Input type="number" step="0.01" id="budgetLimit" placeholder="150000.00" {...register("budgetLimit")} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select id="status" {...register("status")}>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                        </Select>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
                            {editingDept ? "Save Changes" : "Create Department"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
