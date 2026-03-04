"use client";

import { useState, useEffect } from "react";
import { Category, CategoryDto } from "@/types";
import { categoryService } from "@/services/categoryService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Tags, Shield, Clock } from "lucide-react";
import { useForm } from "react-hook-form";

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CategoryDto>();

    const fetchCategories = async () => {
        try {
            setIsLoading(true);
            const data = await categoryService.getAll();
            setCategories(data);
        } catch (error) {
            toast.error("Failed to load categories");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleOpenCreate = () => {
        setEditingCategory(null);
        reset({ name: "", description: "", parentCategoryId: "", defaultWarrantyPeriodMonths: undefined });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (category: Category) => {
        setEditingCategory(category);
        reset({
            name: category.name,
            description: category.description || "",
            parentCategoryId: category.parentCategoryId || "",
            depreciationPolicyId: category.depreciationPolicyId || "",
            defaultWarrantyPeriodMonths: category.defaultWarrantyPeriodMonths,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this category?")) return;
        try {
            await categoryService.delete(id);
            toast.success("Category deleted");
            fetchCategories();
        } catch (error) {
            toast.error("Failed to delete category");
            console.error(error);
        }
    };

    const onSubmit = async (data: CategoryDto) => {
        const isDuplicate = categories.some(
            cat => cat.name.toLowerCase() === data.name.toLowerCase() && cat.id !== editingCategory?.id
        );

        if (isDuplicate) {
            toast.error(`Category "${data.name}" already exists.`);
            return;
        }

        // Clean up payload
        if (!data.parentCategoryId) delete data.parentCategoryId;
        if (!data.depreciationPolicyId) delete data.depreciationPolicyId;
        if (data.defaultWarrantyPeriodMonths) {
            data.defaultWarrantyPeriodMonths = Number(data.defaultWarrantyPeriodMonths);
        } else {
            delete data.defaultWarrantyPeriodMonths;
        }

        try {
            if (editingCategory) {
                await categoryService.update(editingCategory.id!, data);
                toast.success("Category updated");
            } else {
                await categoryService.create(data);
                toast.success("Category created");
            }
            setIsModalOpen(false);
            fetchCategories();
        } catch (error) {
            toast.error("Failed to save category");
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Categories</h1>
                    <p className="text-slate-500">Organize and classify your assets.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Category
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                    </div>
                ) : categories.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <Tags className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No categories found</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">Create categories to better classify your asset portfolio.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-300">
                            Add Category
                        </Button>
                    </div>
                ) : (
                    categories.map((category) => (
                        <Card key={category.id} className="overflow-hidden hover:shadow-md transition-all flex flex-col h-full border-slate-200">
                            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg shrink-0">
                                    <Tags className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <CardTitle className="text-base font-semibold text-slate-900 truncate" title={category.name}>
                                        {category.name}
                                    </CardTitle>
                                    {category.parentCategoryId && (
                                        <span className="text-[10px] font-bold uppercase text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                                            Sub-category
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 flex flex-col">
                                <div className="p-4 space-y-3 flex-1">
                                    {category.description ? (
                                        <p className="text-sm text-slate-600 line-clamp-2" title={category.description}>
                                            {category.description}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">No description provided.</p>
                                    )}

                                    {(category.defaultWarrantyPeriodMonths || category.depreciationPolicyId) && (
                                        <div className="pt-3 border-t border-slate-100 space-y-2">
                                            {category.defaultWarrantyPeriodMonths && (
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <Shield className="h-4 w-4 text-blue-400 shrink-0" />
                                                    <span className="text-xs">Default Warranty:</span>
                                                    <span className="font-semibold text-slate-800 text-xs">
                                                        {category.defaultWarrantyPeriodMonths} months
                                                    </span>
                                                </div>
                                            )}
                                            {category.depreciationPolicyId && (
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <Clock className="h-4 w-4 text-purple-400 shrink-0" />
                                                    <span className="text-xs text-slate-500">Depreciation policy linked</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 bg-slate-50/50 mt-auto border-t border-slate-100 flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(category)} className="h-8">
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(category.id!)} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
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
                title={editingCategory ? "Edit Category" : "Create Category"}
                description={editingCategory ? "Update the details of the category." : "Add a new asset category."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
                        <Input
                            id="name"
                            placeholder="e.g. IT Equipment"
                            {...register("name", { required: "Name is required" })}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message as string}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                            id="description"
                            placeholder="All computers, servers, and peripherals"
                            {...register("description")}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="defaultWarrantyPeriodMonths">Default Warranty (Months)</Label>
                            <Input
                                type="number"
                                id="defaultWarrantyPeriodMonths"
                                min="0"
                                placeholder="24"
                                {...register("defaultWarrantyPeriodMonths")}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="parentCategoryId">Parent Category</Label>
                            <Select id="parentCategoryId" {...register("parentCategoryId")}>
                                <option value="">None (Top Level)</option>
                                {categories.filter(c => c.id !== editingCategory?.id).map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-orange-600 hover:bg-orange-700">
                            {editingCategory ? "Save Changes" : "Create Category"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
