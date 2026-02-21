"use client";

import { useState, useEffect, useMemo } from "react";
import { PurchaseOrder, PurchaseOrderDto, Supplier, POStatus } from "@/types";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { supplierService } from "@/services/supplierService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, ShoppingCart, Calendar, Building2, CheckCircle2, XCircle, MoreHorizontal } from "lucide-react";
import { useForm } from "react-hook-form";

export default function PurchaseOrdersPage() {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);

    const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<PurchaseOrderDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [ordersData, suppliersData] = await Promise.all([
                purchaseOrderService.getAll(),
                supplierService.getAll()
            ]);
            setOrders(ordersData);
            setSuppliers(suppliersData);
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

    const handleOpenCreate = () => {
        setEditingOrder(null);
        reset({
            poNumber: "",
            totalAmount: 0,
            currency: "USD",
            status: POStatus.DRAFT,
            remarks: "",
            supplierId: "",
            departmentId: ""
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (order: PurchaseOrder) => {
        setEditingOrder(order);
        reset({
            poNumber: order.poNumber,
            totalAmount: order.totalAmount,
            currency: order.currency || "USD",
            status: order.status || POStatus.DRAFT,
            supplierId: order.supplierId || "",
            departmentId: order.departmentId || "",
            remarks: order.remarks || ""
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

    const handleUpdateStatus = async (id: string, status: POStatus) => {
        try {
            await purchaseOrderService.updateStatus(id, status);
            toast.success(`Purchase order status updated to ${status.replace('_', ' ')}`);
            fetchData();
        } catch (error) {
            toast.error("Failed to update purchase order status");
            console.error(error);
        }
    };

    const onSubmit = async (data: PurchaseOrderDto) => {
        try {
            data.totalAmount = Number(data.totalAmount);
            if (!data.supplierId) delete data.supplierId;
            if (!data.departmentId) delete data.departmentId;
            if (editingOrder) {
                await purchaseOrderService.update(editingOrder.id!, data);
                toast.success("Purchase order updated");
            } else {
                await purchaseOrderService.create(data);
                toast.success("Purchase order created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to save purchase order");
            console.error(error);
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case POStatus.DRAFT: return "bg-slate-100 text-slate-700 border-slate-200";
            case POStatus.PENDING_APPROVAL: return "bg-amber-100 text-amber-700 border-amber-200";
            case POStatus.APPROVED: return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case POStatus.ORDERED: return "bg-blue-100 text-blue-700 border-blue-200";
            case POStatus.PARTIALLY_DELIVERED: return "bg-indigo-100 text-indigo-700 border-indigo-200";
            case POStatus.DELIVERED: return "bg-green-100 text-green-700 border-green-200";
            case POStatus.CANCELLED:
            case POStatus.REJECTED: return "bg-red-100 text-red-700 border-red-200";
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
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="truncate pr-2">
                                    <CardTitle className="text-lg font-semibold text-slate-900 truncate" title={order.poNumber}>
                                        {order.poNumber}
                                    </CardTitle>
                                    <div className="text-xs font-semibold text-slate-800">
                                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                                    </div>
                                    <div className={`px-2 py-0.5 flex items-center justify-center rounded-full text-[10px] font-bold border ${getStatusStyles(order.status || "")}`}>
                                        {order.status?.replace('_', ' ')}
                                    </div>
                                </div>
                                <CardDescription className="mt-1 font-medium text-slate-600">
                                    ${Number(order.totalAmount).toLocaleString()}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col">
                                <div className="space-y-3 text-sm text-slate-600 flex-1">
                                    <div className="flex items-center gap-2 truncate text-slate-700" title={supplierMap.get(order.supplierId || "") || "Unknown Supplier"}>
                                        <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                                        <span className="truncate font-medium">{supplierMap.get(order.supplierId || "") || "No Supplier Assigned"}</span>
                                    </div>
                                    <div className="space-y-4 pt-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Calendar className="h-4 w-4 text-slate-400" />
                                                <span>Order Date</span>
                                            </div>
                                            <span className="font-medium text-slate-700">{order.orderDate ? new Date(order.orderDate).toLocaleDateString() : ""}</span>
                                        </div>
                                        {order.expectedDeliveryDate && (
                                            <div className="flex justify-between items-center text-sm">
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <Calendar className="h-4 w-4 text-slate-400" />
                                                    <span>Expected Delivery</span>
                                                </div>
                                                <span className="font-medium text-slate-700">{new Date(order.expectedDeliveryDate).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </div>
                                    {order.remarks && (
                                        <p className="text-sm text-slate-500 pt-2 border-t border-slate-100 mt-2 line-clamp-2" title={order.remarks}>
                                            <b className="text-slate-600">Remarks:</b> {order.remarks}
                                        </p>
                                    )}
                                </div>
                                <div className="flex justify-between items-center gap-2 pt-4 border-t border-slate-100 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="flex gap-1">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-50">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                {order.status === POStatus.DRAFT && (
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order.id!, POStatus.PENDING_APPROVAL)}>Submit for Approval</DropdownMenuItem>
                                                )}
                                                {order.status === POStatus.PENDING_APPROVAL && (
                                                    <>
                                                        <DropdownMenuItem onClick={() => handleUpdateStatus(order.id!, POStatus.APPROVED)}>Approve</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleUpdateStatus(order.id!, POStatus.REJECTED)}>Reject</DropdownMenuItem>
                                                    </>
                                                )}
                                                {order.status === POStatus.APPROVED && (
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order.id!, POStatus.ORDERED)}>Mark Ordered</DropdownMenuItem>
                                                )}
                                                {(order.status === POStatus.ORDERED || order.status === POStatus.PARTIALLY_DELIVERED) && (
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order.id!, POStatus.PARTIALLY_DELIVERED)}>Mark Partially Delivered</DropdownMenuItem>
                                                )}
                                                {(order.status === POStatus.ORDERED || order.status === POStatus.PARTIALLY_DELIVERED) && (
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order.id!, POStatus.DELIVERED)}>Mark Delivered</DropdownMenuItem>
                                                )}
                                                {order.status !== POStatus.CANCELLED && order.status !== POStatus.REJECTED && (
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order.id!, POStatus.CANCELLED)} className="text-red-600">Cancel Order</DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(order)} className="h-8">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(order.id!)} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )
                }
            </div >

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingOrder ? "Edit Purchase Order" : "Create Purchase Order"}
                description={editingOrder ? "Update the purchase order details." : "Create a new procurement request."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="poNumber">PO Number</Label>
                            <Input id="poNumber" placeholder="e.g., PO-2023-001" {...register("poNumber")} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="supplierId">Supplier</Label>
                        <Select id="supplierId" {...register("supplierId", { required: "Supplier is required" })}>
                            <option value="">Select Supplier</option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </Select>
                        {errors.supplierId && <p className="text-sm text-red-500">{errors.supplierId.message as string}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="remarks">Remarks</Label>
                        <Input id="remarks" placeholder="Urgent order..." {...register("remarks")} />
                    </div>

                    <div className="grid grid-cols-3 gap-4 border-t pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="totalAmount">Total Amount ($) <span className="text-red-500">*</span></Label>
                            <Input id="totalAmount" type="number" step="0.01" min="0" {...register("totalAmount", { required: true, min: 0 })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="createdAt">Order Date</Label>
                            <Input id="createdAt" type="date" {...register("createdAt")} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="expectedDeliveryDate" className="text-slate-400">Expected Delivery</Label>
                            <Input id="expectedDeliveryDate" type="date" disabled title="Not implemented on backend yet" />
                        </div>
                    </div>

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
        </div >
    );
}
