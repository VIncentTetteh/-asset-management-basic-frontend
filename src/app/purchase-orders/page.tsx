"use client";

import { useState, useEffect, useMemo } from "react";
import { PurchaseOrder, PurchaseOrderDto, Supplier, Department, POStatus } from "@/types";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { supplierService } from "@/services/supplierService";
import { departmentService } from "@/services/departmentService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, ShoppingCart, Building2, CheckCircle2, XCircle, MoreHorizontal, Layers } from "lucide-react";
import { useForm } from "react-hook-form";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

export default function PurchaseOrdersPage() {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PurchaseOrderDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [ordersData, suppliersData, deptData] = await Promise.all([
                purchaseOrderService.getAll(),
                supplierService.getAll(),
                departmentService.getAll(),
            ]);
            setOrders(ordersData);
            setSuppliers(suppliersData);
            setDepartments(deptData);
        } catch (error) {
            toast.error("Failed to load purchase orders");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const normalizePoStatus = (status?: string): string | undefined => {
        if (!status) return undefined;
        if (status === "PENDING") return POStatus.SUBMITTED;
        if (status === "RECEIVED" || status === "ORDERED") return POStatus.DELIVERED;
        return status;
    };

    const handleOpenCreate = () => {
        setEditingOrder(null);
        reset({
            poNumber: "",
            totalAmount: 0,
            currency: "GHS",
            status: POStatus.DRAFT,
            remarks: "",
            supplierId: "",
            departmentId: "",
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (order: PurchaseOrder) => {
        setEditingOrder(order);
        reset({
            poNumber: order.poNumber,
            totalAmount: order.totalAmount,
            currency: order.currency || "GHS",
            status: normalizePoStatus(order.status) || POStatus.DRAFT,
            supplierId: order.supplierId || "",
            departmentId: order.departmentId || "",
            remarks: order.remarks || "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this purchase order?")) return;
        try {
            await purchaseOrderService.delete(id);
            toast.success("Purchase order deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete purchase order");
            console.error(error);
        }
    };

    const handleUpdateStatus = async (id: string, action: "approve" | "reject") => {
        try {
            if (action === "approve") await purchaseOrderService.approve(id);
            else await purchaseOrderService.reject(id);
            toast.success(`Purchase order ${action}d`);
            fetchData();
        } catch (error) {
            toast.error(`Failed to ${action} purchase order`);
            console.error(error);
        }
    };

    const onSubmit = async (data: PurchaseOrderDto) => {
        try {
            const poNumber = data.poNumber?.trim();
            const totalAmount = Number(data.totalAmount);
            if (!poNumber) {
                toast.error("PO Number is required");
                return;
            }
            if (!data.supplierId) {
                toast.error("Supplier is required");
                return;
            }
            if (!data.departmentId) {
                toast.error("Department is required");
                return;
            }
            if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
                toast.error("Total amount must be greater than 0");
                return;
            }

            const payload: Partial<PurchaseOrderDto> = {
                ...data,
                poNumber,
                totalAmount,
                status: normalizePoStatus(data.status),
            };

            // Clean empty optional strings (keep mandatory keys)
            const mandatoryKeys: Array<keyof PurchaseOrderDto> = ["departmentId", "supplierId", "poNumber"];
            (Object.keys(payload) as (keyof PurchaseOrderDto)[]).forEach((k) => {
                if (payload[k] === "" && !mandatoryKeys.includes(k)) {
                    delete payload[k];
                }
            });

            if (editingOrder) {
                const currentStatus = normalizePoStatus(editingOrder.status);
                const desiredStatus = normalizePoStatus(payload.status);
                const organisationId = editingOrder.organisationId || getOrganisationIdFromStorage();
                if (!organisationId) {
                    toast.error("Organisation ID is required");
                    return;
                }

                const updatePayload: PurchaseOrderDto = {
                    poNumber,
                    totalAmount,
                    currency: payload.currency,
                    status: desiredStatus,
                    remarks: payload.remarks,
                    supplierId: data.supplierId,
                    departmentId: data.departmentId,
                    organisationId,
                };

                const updated = await purchaseOrderService.update(editingOrder.id!, updatePayload);
                let finalStatus = normalizePoStatus(updated.status);

                // Backend may ignore direct status edits; apply explicit workflow endpoints when available.
                if (desiredStatus && desiredStatus !== currentStatus && finalStatus !== desiredStatus) {
                    if (desiredStatus === POStatus.APPROVED) {
                        const approved = await purchaseOrderService.approve(editingOrder.id!);
                        finalStatus = normalizePoStatus(approved.status);
                    } else if (desiredStatus === POStatus.REJECTED) {
                        const rejected = await purchaseOrderService.reject(editingOrder.id!);
                        finalStatus = normalizePoStatus(rejected.status);
                    } else {
                        toast.error(`Status change to ${desiredStatus} was not applied by backend workflow`);
                    }
                }

                if (desiredStatus && finalStatus !== desiredStatus) {
                    toast.error("Purchase order updated, but status did not change");
                } else {
                    toast.success("Purchase order updated");
                }
            } else {
                const organisationId = getOrganisationIdFromStorage();
                if (!organisationId) {
                    toast.error("Organisation ID is required");
                    return;
                }
                await purchaseOrderService.create({ ...payload, organisationId } as PurchaseOrderDto);
                toast.success("Purchase order created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string; errors?: Record<string, string> } } };
            const fieldErrors = err.response?.data?.errors;
            const firstFieldError = fieldErrors ? Object.values(fieldErrors)[0] : undefined;
            toast.error(firstFieldError || err.response?.data?.message || "Failed to save purchase order");
            console.error(error);
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case POStatus.DRAFT: return "bg-slate-100 text-slate-700 border-slate-200";
            case POStatus.SUBMITTED:
            case "PENDING": return "bg-amber-100 text-amber-700 border-amber-200";
            case POStatus.APPROVED: return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case POStatus.DELIVERED:
            case "RECEIVED": return "bg-green-100 text-green-700 border-green-200";
            case POStatus.REJECTED:
            case POStatus.CANCELLED: return "bg-red-100 text-red-700 border-red-200";
            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Purchase Orders</h1>
                    <p className="text-slate-500">Manage procurements and track vendor orders.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-sky-600 hover:bg-sky-700">
                    <Plus className="mr-2 h-4 w-4" /> Create PO
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <ShoppingCart className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No purchase orders found</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">Create a purchase order to start tracking asset procurement.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-300">
                            Create PO
                        </Button>
                    </div>
                ) : (
                    orders.map((order) => (
                        <Card key={order.id} className="overflow-hidden hover:shadow-md transition-all group border-slate-200 flex flex-col">
                            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="truncate pr-2 flex-1">
                                    <CardTitle className="text-base font-semibold text-slate-900 truncate" title={order.poNumber}>
                                        {order.poNumber}
                                    </CardTitle>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                                    </div>
                                </div>
                                <div className={`px-2 py-0.5 flex items-center rounded-full text-[10px] font-bold border shrink-0 mt-0.5 ${getStatusStyles(order.status || "")}`}>
                                    {order.status?.replace(/_/g, " ")}
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col">
                                <div className="space-y-3 text-sm text-slate-600 flex-1">
                                    <div className="text-xl font-bold text-slate-900">
                                        {order.currency || "GHS"} {Number(order.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="flex items-center gap-2 truncate text-slate-700" title={supplierMap.get(order.supplierId || "") || "Unknown Supplier"}>
                                        <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                                        <span className="truncate font-medium">{supplierMap.get(order.supplierId || "") || "No Supplier"}</span>
                                    </div>
                                    {order.departmentId && (
                                        <div className="flex items-center gap-2 truncate text-slate-700">
                                            <Layers className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="truncate">{deptMap.get(order.departmentId) || order.departmentId}</span>
                                        </div>
                                    )}
                                    {order.remarks && (
                                        <p className="text-sm text-slate-500 pt-2 border-t border-slate-100 mt-2 line-clamp-2" title={order.remarks}>
                                            <b className="text-slate-600">Remarks:</b> {order.remarks}
                                        </p>
                                    )}
                                </div>
                                <div className="flex justify-between items-center gap-2 pt-4 border-t border-slate-100 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="flex gap-1">
                                        {/* Approve / Reject available for submitted status */}
                                        {(order.status === POStatus.SUBMITTED || order.status === "PENDING") && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-50">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="bg-white border border-slate-200 rounded-lg shadow-lg p-1 min-w-[120px] z-50">
                                                    <DropdownMenuItem
                                                        onClick={() => handleUpdateStatus(order.id!, "approve")}
                                                        className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" /> Approve
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleUpdateStatus(order.id!, "reject")}
                                                        className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                                    >
                                                        <XCircle className="h-4 w-4" /> Reject
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(order)} className="h-8 w-8 p-0">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(order.id!)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingOrder ? "Edit Purchase Order" : "Create Purchase Order"}
                description={editingOrder ? "Update the purchase order details." : "Create a new procurement request."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="poNumber">PO Number <span className="text-red-500">*</span></Label>
                            <Input id="poNumber" placeholder="e.g., PO-2025-001" {...register("poNumber", { required: "PO Number is required" })} />
                            {errors.poNumber && <p className="text-sm text-red-500">{errors.poNumber.message}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="supplierId">Supplier <span className="text-red-500">*</span></Label>
                        <Select id="supplierId" {...register("supplierId", { required: "Supplier is required" })}>
                            <option value="">Select Supplier</option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </Select>
                        {errors.supplierId && <p className="text-sm text-red-500">{errors.supplierId.message as string}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="departmentId">Department <span className="text-red-500">*</span></Label>
                        <Select id="departmentId" {...register("departmentId", { required: "Department is required" })}>
                            <option value="">Select Department</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </Select>
                        {errors.departmentId && <p className="text-sm text-red-500">{errors.departmentId.message as string}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="remarks">Remarks</Label>
                        <Input id="remarks" placeholder="IT equipment batch, urgent order..." {...register("remarks")} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="totalAmount">Total Amount <span className="text-red-500">*</span></Label>
                            <Input id="totalAmount" type="number" step="0.01" min="0.01" {...register("totalAmount", { required: true, min: 0.01 })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Select id="currency" {...register("currency")}>
                                <option value="GHS">GHS</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                            </Select>
                        </div>
                    </div>

                    {editingOrder && (
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select id="status" {...register("status")}>
                                {Object.values(POStatus).map(s => (
                                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                                ))}
                            </Select>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-sky-600 hover:bg-sky-700">
                            {editingOrder ? "Save Changes" : "Create Order"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
