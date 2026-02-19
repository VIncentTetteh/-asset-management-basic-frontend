"use client";

import { useState, useEffect, useMemo } from "react";
import { Department, DepartmentDto, Organisation } from "@/types";
import { departmentService } from "@/services/departmentService";
import { organisationService } from "@/services/organisationService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { useForm } from "react-hook-form";

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DepartmentDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [deptsData, orgsData] = await Promise.all([
                departmentService.getAll(),
                organisationService.getAll(),
            ]);
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

    const handleOpenCreate = () => {
        setEditingDept(null);
        reset({ name: "", organisationId: "" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (dept: Department) => {
        setEditingDept(dept);
        reset({ name: dept.name, organisationId: dept.organisationId });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this department?")) return;
        try {
            await departmentService.delete(id);
            toast.success("Department deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete department");
            console.error(error);
        }
    };

    const onSubmit = async (data: DepartmentDto) => {
        const isDuplicate = departments.some(
            dept => dept.name.toLowerCase() === data.name.toLowerCase() && dept.id !== editingDept?.id
        );

        if (isDuplicate) {
            toast.error(`Department "${data.name}" already exists.`);
            return;
        }

        try {
            if (editingDept) {
                await departmentService.update(editingDept.id, data);
                toast.success("Department updated");
            } else {
                await departmentService.create(data);
                toast.success("Department created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to save department");
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Departments</h1>
                    <p className="text-slate-500">Manage departments and their organization assignments.</p>
                </div>
                <Button onClick={handleOpenCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add Department
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <p>Loading...</p>
                ) : departments.length === 0 ? (
                    <p className="text-slate-500 col-span-full text-center py-10">No departments found. Create one to get started.</p>
                ) : (
                    departments.map((dept) => (
                        <Card key={dept.id}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {dept.name}
                                </CardTitle>
                                <Layers className="h-4 w-4 text-slate-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-slate-500 mb-4">
                                    Organisation: <span className="font-medium text-slate-900">{orgMap.get(dept.organisationId) || "Unknown"}</span>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(dept)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(dept.id)}>
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
                title={editingDept ? "Edit Department" : "Create Department"}
                description={editingDept ? "Update department details." : "Add a new department."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. Engineering"
                            {...register("name", { required: "Name is required" })}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="organisationId">Organisation</Label>
                        <Select
                            id="organisationId"
                            {...register("organisationId", { required: "Organisation is required" })}
                        >
                            <option value="">Select an Organisation</option>
                            {organisations.map((org) => (
                                <option key={org.id} value={org.id}>
                                    {org.name}
                                </option>
                            ))}
                        </Select>
                        {errors.organisationId && <p className="text-sm text-red-500">{errors.organisationId.message}</p>}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting}>
                            {editingDept ? "Save Changes" : "Create Department"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
