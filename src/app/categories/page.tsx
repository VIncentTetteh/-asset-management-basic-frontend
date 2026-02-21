"use client";

import { useState, useEffect } from "react";
import { Category } from "@/types";
import { categoryService } from "@/services/categoryService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { useForm } from "react-hook-form";

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<any>();

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
        reset({ name: "", description: "", parentCategoryId: "" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (category: Category) => {
        setEditingCategory(category);
        reset({
            name: category.name,
            description: category.description || "",
            parentCategoryId: category.parentCategoryId || ""
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

    const onSubmit = async (data: any) => {
        const isDuplicate = categories.some(
            cat => cat.name.toLowerCase() === data.name.toLowerCase() && cat.id !== editingCategory?.id
        );

        if (isDuplicate) {
            toast.error(`Category "${data.name}" already exists.`);
            return;
        }

        try {
            // Clean up payload
            if (!data.parentCategoryId) delete data.parentCategoryId;

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
                        <Card key={category.id} className="overflow-hidden hover:shadow-md transition-all group border-slate-200">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-lg font-semibold text-slate-900 truncate" title={category.name}>
                                    {category.name}
                                </CardTitle>
                                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg shrink-0">
                                    <Tags className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex flex-col justify-between" style={{ minHeight: '120px' }}>
                                <div>
                                    {category.description && (
                                        <p className="text-sm text-slate-600 line-clamp-2 mb-2">{category.description}</p>
                                    )}
                                    {category.parentCategoryId && (
                                        <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                            Subcategory
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end gap-2 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(category)} className="h-8">
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(category.id!)} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
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
                title={editingCategory ? "Edit Category" : "Create Category"}
                description={editingCategory ? "Update the details of the category." : "Add a new asset category."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
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

                    <div className="space-y-2">
                        <Label htmlFor="parentCategoryId">Parent Category (Optional)</Label>
                        <Select id="parentCategoryId" {...register("parentCategoryId")}>
                            <option value="">None (Top Level)</option>
                            {categories.filter(c => c.id !== editingCategory?.id).map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </Select>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
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
