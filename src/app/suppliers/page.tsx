"use client";

import { useState, useEffect } from "react";
import { Supplier, SupplierDto } from "@/types";
import { supplierService } from "@/services/supplierService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import {
    Plus, Pencil, Search,
    MapPin,
    Mail,
    Phone,
    Globe,
    UserIcon,
    Truck,
    Star,
    Trash2
} from "lucide-react";
import { useForm } from "react-hook-form";

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SupplierDto>();

    const fetchSuppliers = async () => {
        try {
            setIsLoading(true);
            const data = await supplierService.getAll();
            setSuppliers(data);
        } catch (error) {
            toast.error("Failed to load suppliers");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const handleOpenCreate = () => {
        setEditingSupplier(null);
        reset({
            name: "",
            contactPerson: "",
            email: "",
            phone: "",
            address: "",
            website: "",
            rating: 0
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        reset({
            name: supplier.name,
            contactPerson: supplier.contactPerson || "",
            email: supplier.email || "",
            phone: supplier.phone || "",
            address: supplier.address || "",
            website: supplier.website || "",
            rating: supplier.rating || 0
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this supplier?")) return;
        try {
            await supplierService.delete(id);
            toast.success("Supplier deleted");
            fetchSuppliers();
        } catch (error) {
            toast.error("Failed to delete supplier");
            console.error(error);
        }
    };

    const onSubmit = async (data: SupplierDto) => {
        const isDuplicate = suppliers.some(
            sup => sup.name.toLowerCase() === data.name.toLowerCase() && sup.id !== editingSupplier?.id
        );

        if (isDuplicate) {
            toast.error(`Supplier "${data.name}" already exists.`);
            return;
        }

        try {
            // Ensure rating is a number
            if (data.rating !== undefined) {
                data.rating = Number(data.rating);
            }

            if (editingSupplier) {
                await supplierService.update(editingSupplier.id, data);
                toast.success("Supplier updated");
            } else {
                await supplierService.create(data);
                toast.success("Supplier created");
            }
            setIsModalOpen(false);
            fetchSuppliers();
        } catch (error) {
            toast.error("Failed to save supplier");
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Suppliers</h1>
                    <p className="text-slate-500">Manage vendors and procurement sources.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Supplier
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                ) : suppliers.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <Truck className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No suppliers found</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">Create your vendor database to streamline your procurement process.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300">
                            Add Supplier
                        </Button>
                    </div>
                ) : (
                    suppliers.map((supplier) => (
                        <Card key={supplier.id} className="overflow-hidden hover:shadow-md transition-all group border-slate-200 flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="truncate pr-2">
                                    <CardTitle className="text-lg font-semibold text-slate-900 truncate" title={supplier.name}>
                                        {supplier.name}
                                    </CardTitle>
                                    <CardDescription className="flex items-center gap-1 mt-1 font-medium text-amber-500">
                                        {supplier.rating ? (
                                            <><Star className="h-3 w-3 fill-current" /> {supplier.rating}/5 Rating</>
                                        ) : (
                                            <span className="text-slate-400 font-normal">No Rating</span>
                                        )}
                                    </CardDescription>
                                </div>
                                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg shrink-0">
                                    <Truck className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col">
                                <div className="space-y-2 text-sm text-slate-600 flex-1">
                                    <div className="space-y-4 pt-1">
                                        <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <UserIcon className="h-4 w-4 text-slate-400" />
                                                <span>Contact</span>
                                            </div>
                                            <span className="font-medium text-slate-700">{supplier.contactPerson || "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Mail className="h-4 w-4 text-slate-400" />
                                                <span>Email</span>
                                            </div>
                                            <span className="font-medium text-slate-700">
                                                {supplier.email ? (
                                                    <a href={`mailto:${supplier.email}`} className="text-sky-600 hover:underline truncate">
                                                        {supplier.email}
                                                    </a>
                                                ) : "N/A"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Phone className="h-4 w-4 text-slate-400" />
                                                <span>Phone</span>
                                            </div>
                                            <span className="font-medium text-slate-700">{supplier.phone || "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Globe className="h-4 w-4 text-slate-400" />
                                                <span>Website</span>
                                            </div>
                                            <span className="font-medium text-slate-700">
                                                {supplier.website ? (
                                                    <a href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline truncate">
                                                        {supplier.website.replace(/^https?:\/\//, '')}
                                                    </a>
                                                ) : "N/A"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(supplier)} className="h-8">
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(supplier.id)} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
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
                title={editingSupplier ? "Edit Supplier" : "Create Supplier"}
                description={editingSupplier ? "Update the vendor's details." : "Add a new vendor to the platform."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="name">Company Name <span className="text-red-500">*</span></Label>
                        <Input
                            id="name"
                            placeholder="e.g. Acme Corp"
                            {...register("name", { required: "Company name is required" })}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message as string}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="contactPerson">Contact Person</Label>
                            <Input id="contactPerson" placeholder="Jane Doe" {...register("contactPerson")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rating">Rating (0-5)</Label>
                            <Input id="rating" type="number" step="0.1" min="0" max="5" placeholder="4.5" {...register("rating")} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="contact@acme.com" {...register("email")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" placeholder="+1 (555) 123-4567" {...register("phone")} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input id="website" placeholder="www.acme.com" {...register("website")} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Physical Address</Label>
                        <Input id="address" placeholder="123 Corporate Blvd, Suite 100..." {...register("address")} />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                            {editingSupplier ? "Save Changes" : "Create Supplier"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
