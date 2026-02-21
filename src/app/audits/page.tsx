"use client";

import { useState, useEffect, useMemo } from "react";
import { Audit, AuditDto, Asset, User } from "@/types";
import { auditService } from "@/services/auditService";
import { assetService } from "@/services/assetService";
import { userService } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, ClipboardCheck, Calendar, Hexagon, User as UserIcon, CheckSquare, XSquare } from "lucide-react";
import { useForm } from "react-hook-form";

export default function AuditsPage() {
    const [audits, setAudits] = useState<Audit[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAudit, setEditingAudit] = useState<Audit | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AuditDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [auditsData, assetsData, usersData] = await Promise.all([
                auditService.getAll(),
                assetService.getAll(),
                userService.getAll()
            ]);
            setAudits(auditsData);
            setAssets(assetsData);
            setUsers(usersData);
        } catch (error) {
            toast.error("Failed to load audit records");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const assetMap = useMemo(() => new Map(assets.map(a => [a.id, a.name])), [assets]);
    const assetTagMap = useMemo(() => new Map(assets.map(a => [a.id, a.assetTag])), [assets]);
    const userMap = useMemo(() => new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`])), [users]);

    const handleOpenCreate = () => {
        setEditingAudit(null);
        reset({
            assetId: "", // Keep assetId for now, as it's used in the form
            departmentId: "",
            auditDate: new Date().toISOString().split('T')[0],
            conductedById: "",
            status: "PENDING",
            remarks: ""
        });
        setIsModalOpen(true);
    };

    const handleEdit = (audit: Audit) => {
        setEditingAudit(audit);
        reset({
            assetId: audit.assetId, // Keep assetId for now, as it's used in the form
            organisationId: audit.organisationId || "",
            departmentId: audit.departmentId || "",
            auditDate: audit.auditDate ? new Date(audit.auditDate).toISOString().split('T')[0] : "",
            conductedById: audit.conductedById || "",
            status: audit.status || "PENDING",
            remarks: audit.remarks || ""
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this audit record?")) return;
        try {
            await auditService.delete(id);
            toast.success("Audit deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete audit");
            console.error(error);
        }
    };

    const handlePass = async (id: string) => {
        try {
            await auditService.updateStatus(id, "PASSED");
            toast.success("Audit marked as Passed");
            fetchData();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const handleFail = async (id: string) => {
        try {
            await auditService.updateStatus(id, "FAILED");
            toast.error("Audit marked as Failed");
            fetchData();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const onSubmit = async (data: AuditDto) => {
        try {
            if (data.conductedById === "") delete data.conductedById;
            if (data.departmentId === "") delete data.departmentId;
            if (data.remarks === "") delete data.remarks;
            if (data.organisationId === "") delete data.organisationId;

            if (editingAudit) {
                // The instruction implies updateStatus, but the original code was update(id, data).
                // Sticking to the instruction for updateStatus, but if full data update is needed, this might change.
                await auditService.updateStatus(editingAudit.id!, data.status!);
                toast.success("Audit updated successfully");
            } else {
                await auditService.create(data);
                toast.success("Audit scheduled");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to save audit");
            console.error(error);
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'PASSED': return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case 'PENDING': return "bg-blue-100 text-blue-700 border-blue-200";
            case 'IN_PROGRESS': return "bg-amber-100 text-amber-700 border-amber-200";
            case 'FAILED': return "bg-red-100 text-red-700 border-red-200";
            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Audits & Inspections</h1>
                    <p className="text-slate-500">Track compliance and verify physical asset inventory.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-fuchsia-600 hover:bg-fuchsia-700">
                    <Plus className="mr-2 h-4 w-4" /> Schedule Audit
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fuchsia-600"></div>
                    </div>
                ) : audits.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <ClipboardCheck className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No audits found</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">Schedule regular audits to ensure your asset inventory remains accurate and compliant.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 hover:border-fuchsia-300">
                            Schedule Audit
                        </Button>
                    </div>
                ) : (
                    audits.map((audit) => (
                        <Card key={audit.id} className={`overflow-hidden hover:shadow-md transition-all group border-l-4 ${audit.status === 'PASSED' ? 'border-l-emerald-500' :
                            audit.status === 'FAILED' ? 'border-l-red-500' :
                                audit.status === 'IN_PROGRESS' ? 'border-l-amber-500' :
                                    'border-l-blue-500'
                            }`}>
                            <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="truncate pr-2 w-full">
                                    <div className="flex justify-between items-start mb-1">
                                        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 truncate pr-2" title={assetMap.get(audit.assetId || "") || audit.assetId}>
                                            <Hexagon className="h-3.5 w-3.5 text-fuchsia-600" />
                                            {audit.auditDate ? new Date(audit.auditDate).toLocaleDateString() : "No Date"}
                                        </CardTitle>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="text-xs font-semibold text-slate-800">
                                                {audit.auditDate ? new Date(audit.auditDate).toLocaleDateString() : ""}
                                            </div>
                                            <div className={`px-2 flex items-center h-5 text-[10px] font-bold rounded-full border shrink-0 ${getStatusStyles(audit.status || 'PENDING')}`}>
                                                {audit.status?.replace('_', ' ')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5 ml-5">
                                        {assetTagMap.get(audit.assetId || "") || ""}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col">
                                <div className="space-y-3 text-sm text-slate-600 flex-1">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Calendar className="h-4 w-4 text-slate-400" />
                                            <span className="font-medium">{audit.auditDate ? new Date(audit.auditDate).toLocaleDateString() : ""}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700 mt-1 truncate" title={userMap.get(audit.conductedById || "") || "Unassigned"}>
                                            <UserIcon className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="truncate">{userMap.get(audit.conductedById || "") || "Unassigned"}</span>
                                        </div>
                                    </div>

                                    {(audit.remarks) && (
                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                            {audit.remarks && (
                                                <p className="text-sm text-slate-600 pt-2 border-t border-slate-100 mt-2 line-clamp-2" title={audit.remarks}>
                                                    <b className="text-slate-700">Remarks:</b> {audit.remarks}
                                                </p>
                                            )}    </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center gap-2 pt-4 border-t border-slate-100 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="flex gap-1">
                                        {(audit.status === 'PENDING' || audit.status === 'IN_PROGRESS') && (
                                            <>
                                                <Button variant="ghost" size="sm" onClick={() => handlePass(audit.id!)} className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="Pass Audit">
                                                    <CheckSquare className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleFail(audit.id!)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" title="Fail Audit">
                                                    <XSquare className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" className="h-8 gap-1 border-slate-200 text-slate-600 hover:bg-slate-50"
                                            onClick={() => handleEdit(audit)}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(audit.id!)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
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
                title={editingAudit ? "Edit Audit Record" : "Schedule Audit"}
                description={editingAudit ? "Update the audit findings." : "Schedule an asset for review or inspection."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="assetId">Target Asset <span className="text-red-500">*</span></Label>
                        <Select id="assetId" {...register("assetId", { required: "Asset is required" })} disabled={!!editingAudit}>
                            <option value="">Select Asset</option>
                            {assets.map((a) => (
                                <option key={a.id} value={a.id}>{a.name} ({a.assetTag || 'NO-TAG'})</option>
                            ))}
                        </Select>
                        {errors.assetId && <p className="text-sm text-red-500">{errors.assetId.message as string}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="auditDate">Audit Date <span className="text-red-500">*</span></Label>
                            <Input id="auditDate" type="date" {...register("auditDate", { required: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="departmentId">Department to Audit</Label>
                            <Select id="departmentId" {...register("departmentId", { required: true })}>
                                <option value="PENDING">PENDING</option>
                                <option value="IN_PROGRESS">IN PROGRESS</option>
                                <option value="PASSED">PASSED</option>
                                <option value="FAILED">FAILED</option>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="conductedById">Assigned Auditor</Label>
                        <Select id="conductedById" {...register("conductedById", { required: true })}>
                            <option value="">Unassigned</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                            ))}
                        </Select>
                    </div>

                    <div className="space-y-2 col-span-2">
                        <Label htmlFor="remarks">Audit Notes / Findings</Label>
                        <Input id="remarks" placeholder="Any initial remarks or findings observed during the audit..." {...register("remarks")} />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-fuchsia-600 hover:bg-fuchsia-700">
                            {editingAudit ? "Save Changes" : "Schedule Audit"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div >
    );
}
