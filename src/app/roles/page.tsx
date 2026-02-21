"use client";

import { useState, useEffect, useMemo } from "react";
import { Role, RoleDto, Organisation } from "@/types";
import { roleService } from "@/services/roleService";
import { organisationService } from "@/services/organisationService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Shield, Lock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RoleDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [rolesData, orgsData] = await Promise.all([
                roleService.getAll(),
                organisationService.getAll()
            ]);
            setRoles(rolesData);
            setOrganisations(orgsData);
        } catch (error) {
            toast.error("Failed to load roles");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const orgMap = useMemo(() => new Map(organisations.map(o => [o.id, o.name])), [organisations]);

    // Hardcode a list of common permissions for the multi-select payload
    const ALL_PERMISSIONS = [
        "ASSET_READ", "ASSET_WRITE", "ASSET_DELETE",
        "USER_READ", "USER_WRITE", "USER_DELETE",
        "ORG_READ", "ORG_WRITE", "ORG_DELETE",
        "PO_READ", "PO_WRITE", "PO_APPROVE",
        "FINANCE_READ", "AUDIT_READ", "AUDIT_WRITE",
        "MAINTENANCE_WRITE"
    ];

    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

    const handleOpenCreate = () => {
        setEditingRole(null);
        setSelectedPermissions([]);
        reset({
            name: "",
            description: "",
            organisationId: "",
            isSystemRole: false
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (role: Role) => {
        // System roles like SUPER_ADMIN usually can't be edited by normal UI flows, but we'll allow viewing
        if (role.isSystemRole) {
            toast("System roles cannot be modified.", { icon: "🔒" });
            // return; // Commented out to allow exploring the UI
        }
        setEditingRole(role);
        setSelectedPermissions(role.permissions || []);
        reset({
            name: role.name,
            description: role.description || "",
            organisationId: role.organisationId || "",
            isSystemRole: role.isSystemRole
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (role: Role) => {
        if (role.isSystemRole) {
            toast.error("System roles cannot be deleted.");
            return;
        }
        if (!confirm("Are you sure you want to delete this role? Users with this role might lose access.")) return;
        try {
            await roleService.delete(role.id!);
            toast.success("Role deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete role");
            console.error(error);
        }
    };

    const togglePermission = (perm: string) => {
        if (selectedPermissions.includes(perm)) {
            setSelectedPermissions(selectedPermissions.filter(p => p !== perm));
        } else {
            setSelectedPermissions([...selectedPermissions, perm]);
        }
    };

    const onSubmit = async (data: RoleDto) => {
        const isDuplicate = roles.some(
            r => r.name.toLowerCase() === data.name.toLowerCase() && r.id !== editingRole?.id
        );

        if (isDuplicate) {
            toast.error(`Role "${data.name}" already exists.`);
            return;
        }

        try {
            if (!data.organisationId) delete data.organisationId;
            data.permissions = selectedPermissions;

            if (editingRole) {
                if (editingRole.isSystemRole) {
                    toast.error("Cannot save edits to a System Role.");
                    return;
                }
                await roleService.update(editingRole.id!, data);
                toast.success("Role updated");
            } else {
                await roleService.create(data);
                toast.success("Role created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to save role");
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Access Roles</h1>
                    <p className="text-slate-500">Configure Role-Based Access Control (RBAC) profiles.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-zinc-800 hover:bg-zinc-900">
                    <Plus className="mr-2 h-4 w-4" /> Create Custom Role
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-800"></div>
                    </div>
                ) : roles.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <Shield className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No roles configured</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">Create security roles like "Admin" or "Auditor" to map permissions to your users.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300">
                            Configure First Role
                        </Button>
                    </div>
                ) : (
                    roles.map((role) => (
                        <Card key={role.id} className="overflow-hidden hover:shadow-md transition-all group border-slate-200 flex flex-col relative">
                            {role.isSystemRole && (
                                <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none" title="System Role - Cannot be deleted">
                                    <div className="absolute top-[-10px] right-[-30px] w-[80px] h-[30px] bg-sky-500 rotate-45 transform origin-bottom-right z-10"></div>
                                    <Lock className="absolute top-[3px] right-[3px] h-3 w-3 text-white z-20 pointer-events-auto" />
                                </div>
                            )}
                            <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="truncate pr-2 w-full">
                                    <div className="flex justify-between items-start mb-1">
                                        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-1.5 truncate pr-6" title={role.name}>
                                            <Shield className={`h-4 w-4 shrink-0 ${role.isSystemRole ? 'text-sky-600' : 'text-zinc-600'}`} />
                                            <span className="truncate">{role.name}</span>
                                        </CardTitle>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5 ml-5 truncate" title={orgMap.get(role.organisationId || "") || "Global Role"}>
                                        {orgMap.get(role.organisationId || "") || "Global Access"}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col justify-between">
                                <div className="space-y-3 text-sm text-slate-600 flex-1">
                                    <p className="line-clamp-2" title={role.description}>{role.description || "No description provided."}</p>

                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <div className="text-xs font-semibold uppercase text-slate-400 mb-2">Granted Permissions ({role.permissions?.length || 0})</div>
                                        <div className="flex flex-wrap gap-1">
                                            {role.permissions?.slice(0, 4).map(p => (
                                                <span key={p} className="px-1.5 py-0.5 bg-slate-100 text-[10px] rounded border border-slate-200 text-slate-600 font-mono" title={p}>
                                                    {p.replace('_', ' ')}
                                                </span>
                                            ))}
                                            {(role.permissions?.length || 0) > 4 && (
                                                <span className="px-1.5 py-0.5 bg-slate-50 text-[10px] rounded border border-slate-200 text-slate-500 font-mono">
                                                    +{role.permissions!.length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end items-center gap-2 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {role.isSystemRole ? (
                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(role)} className="h-8">
                                            <ShieldAlert className="h-3.5 w-3.5 mr-1" /> View System Policy
                                        </Button>
                                    ) : (
                                        <>
                                            <Button variant="outline" size="sm" onClick={() => handleOpenEdit(role)} className="h-8 w-8 p-0">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(role)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingRole ? (editingRole.isSystemRole ? "View System Role Policy" : "Edit Custom Role") : "Create Custom Role"}
                description={editingRole?.isSystemRole ? "System roles are hardcoded by the application and cannot be structurally altered." : "Define an access control envelope to assign to users."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    {editingRole?.isSystemRole && (
                        <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm mb-4 border border-blue-200 flex items-start gap-2">
                            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                            <p><strong>System Defined Profile.</strong> This role is locked. You are viewing it in Read-Only mode.</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="name">Role Name <span className="text-red-500">*</span></Label>
                        <Input
                            id="name"
                            placeholder="e.g. Finance Auditor"
                            {...register("name", { required: "Name is required" })}
                            disabled={!!(editingRole?.isSystemRole)}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message as string}</p>}
                    </div>

                    <div className="space-y-2 border-t pt-4">
                        <Label htmlFor="organisationId">Bounded Organisation (Optional)</Label>
                        <Select id="organisationId" {...register("organisationId")} disabled={!!(editingRole?.isSystemRole)}>
                            <option value="">Global (All Orgs)</option>
                            {organisations.map((org) => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </Select>
                        <p className="text-[10px] text-slate-500">Leaving this blank creates a system-wide role applicable to all tenants.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Profile Description</Label>
                        <Input id="description" placeholder="Read-only access to POs and Audits..." {...register("description")} disabled={!!(editingRole?.isSystemRole)} />
                    </div>

                    <div className="space-y-3 border-t pt-4 border-b pb-4">
                        <Label>Granular Permissions</Label>
                        <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-2 bg-slate-50 rounded border border-slate-200">
                            {ALL_PERMISSIONS.map(perm => (
                                <div key={perm} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id={`perm-${perm}`}
                                        className="rounded border-gray-300 text-zinc-600 shadow-sm focus:border-zinc-300 focus:ring focus:ring-zinc-200 focus:ring-opacity-50"
                                        checked={selectedPermissions.includes(perm)}
                                        onChange={() => !editingRole?.isSystemRole && togglePermission(perm)}
                                        disabled={!!(editingRole?.isSystemRole)}
                                    />
                                    <Label htmlFor={`perm-${perm}`} className="text-xs font-mono cursor-pointer">{perm}</Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            {editingRole?.isSystemRole ? "Close" : "Cancel"}
                        </Button>
                        {!editingRole?.isSystemRole && (
                            <Button type="submit" isLoading={isSubmitting} className="bg-zinc-800 hover:bg-zinc-900">
                                {editingRole ? "Save Updates" : "Issue Custom Role"}
                            </Button>
                        )}
                    </div>
                </form>
            </Modal>
        </div>
    );
}
