"use client";

import { useState, useEffect } from "react";
import { Supplier, SupplierDto } from "@/types";
import { supplierService } from "@/services/supplierService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import {
    Plus, Pencil,
    MapPin,
    Mail,
    Phone,
    Truck,
    Trash2,
    Hash
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
            email: "",
            phone: "",
            address: "",
            contactPerson: "",
            taxId: "",
            registrationNumber: "",
            bankDetails: "",
            status: "ACTIVE",
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        reset({
            name: supplier.name,
            email: supplier.email || "",
            phone: supplier.phone || "",
            address: supplier.address || "",
            contactPerson: supplier.contactPerson || "",
            taxId: supplier.taxId || "",
            registrationNumber: supplier.registrationNumber || "",
            bankDetails: supplier.bankDetails || "",
            status: supplier.status || "ACTIVE",
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
        const normalizedName = data.name.trim();
        if (!normalizedName) {
            toast.error("Company name is required");
            return;
        }

        const isDuplicate = suppliers.some(
            sup => sup.name.trim().toLowerCase() === normalizedName.toLowerCase() && sup.id !== editingSupplier?.id
        );

        if (isDuplicate) {
            toast.error(`Supplier "${normalizedName}" already exists.`);
            return;
        }

        const payload: SupplierDto = { ...data, name: normalizedName };
        // Remove empty optional strings
        (Object.keys(payload) as (keyof SupplierDto)[]).forEach((key) => {
            if (payload[key] === "") delete (payload as Partial<SupplierDto>)[key];
        });

        try {
            if (editingSupplier) {
                await supplierService.update(editingSupplier.id, payload);
                toast.success("Supplier updated");
            } else {
                await supplierService.create(payload);
                toast.success("Supplier created");
            }
            setIsModalOpen(false);
            fetchSuppliers();
        } catch (error) {
            toast.error("Failed to save supplier");
            console.error(error);
        }
    };

    const getStatusStyles = (status?: string) => {
        switch (status) {
            case "ACTIVE": return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case "BLACKLISTED": return "bg-red-100 text-red-700 border-red-200";
            case "INACTIVE": return "bg-slate-100 text-slate-500 border-slate-200";
            default: return "bg-slate-100 text-slate-500 border-slate-200";
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
                                <div className="truncate pr-2 flex-1">
                                    <CardTitle className="text-lg font-semibold text-slate-900 truncate" title={supplier.name}>
                                        {supplier.name}
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStatusStyles(supplier.status)}`}>
                                            {supplier.status || "ACTIVE"}
                                        </span>
                                    </CardDescription>
                                </div>
                                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg shrink-0">
                                    <Truck className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col">
                                <div className="space-y-2 text-sm text-slate-600 flex-1">
                                    <div className="space-y-3 pt-1">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                                            {supplier.email ? (
                                                <a href={`mailto:${supplier.email}`} className="text-sky-600 hover:underline truncate">
                                                    {supplier.email}
                                                </a>
                                            ) : <span className="text-slate-400">—</span>}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="text-slate-700">{supplier.contactPerson ? `${supplier.contactPerson} • ` : ""}{supplier.phone || "—"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="truncate text-slate-700">{supplier.address || "—"}</span>
                                        </div>
                                        {supplier.registrationNumber && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Hash className="h-4 w-4 text-slate-400 shrink-0" />
                                                <span className="truncate text-slate-600 text-xs font-mono">{supplier.registrationNumber}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
                            placeholder="e.g. TechCom Ghana Ltd"
                            {...register("name", {
                                required: "Company name is required",
                                validate: (value) => value.trim().length > 0 || "Company name is required",
                            })}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message as string}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Contact Email</Label>
                            <Input id="email" type="email" placeholder="sales@vendor.com" {...register("email")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Contact Phone</Label>
                            <Input id="phone" placeholder="+233302000000" {...register("phone")} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Physical Address</Label>
                        <Input id="address" placeholder="Ring Road, Accra" {...register("address")} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="contactPerson">Contact Person</Label>
                        <Input id="contactPerson" placeholder="e.g. John Smith" {...register("contactPerson")} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="taxId">Tax ID</Label>
                            <Input id="taxId" placeholder="VAT-001" {...register("taxId")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="registrationNumber">Registration No.</Label>
                            <Input id="registrationNumber" placeholder="COMP-2020" {...register("registrationNumber")} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bankDetails">Bank Details</Label>
                        <Input id="bankDetails" placeholder="Account: 123456789, Routing: 123456" {...register("bankDetails")} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select id="status" {...register("status")}>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                            <option value="BLACKLISTED">BLACKLISTED</option>
                        </Select>
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
