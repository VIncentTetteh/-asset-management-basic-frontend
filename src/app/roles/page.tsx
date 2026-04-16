"use client";

import { useState, useEffect } from "react";
import { Role, RoleDto } from "@/types";
import { roleService } from "@/services/roleService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageSpinner } from "@/components/ui/spinner";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Shield, Lock, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";


// Permission groups matching the backend Permission enum categories
const PERMISSION_GROUPS: { label: string; permissions: string[] }[] = [
    { label: "Assets", permissions: ["VIEW_ASSETS", "CREATE_ASSET", "EDIT_ASSET", "DELETE_ASSET", "DISPOSE_ASSET", "TRANSFER_ASSET", "CHECKOUT_ASSET", "REGENERATE_QR"] },
    { label: "Approvals", permissions: ["APPROVE_REQUESTS", "REJECT_REQUESTS", "ESCALATE_REQUESTS"] },
    { label: "Budgets", permissions: ["VIEW_BUDGETS", "MANAGE_BUDGETS", "APPROVE_BUDGET"] },
    { label: "Users", permissions: ["VIEW_USERS", "MANAGE_USERS", "EDIT_USER", "DELETE_USER"] },
    { label: "Departments", permissions: ["VIEW_DEPARTMENTS", "MANAGE_DEPARTMENTS"] },
    { label: "Locations", permissions: ["VIEW_LOCATIONS", "MANAGE_LOCATIONS"] },
    { label: "Categories", permissions: ["VIEW_CATEGORIES", "MANAGE_CATEGORIES"] },
    { label: "Maintenance", permissions: ["VIEW_MAINTENANCE", "SCHEDULE_MAINTENANCE", "MARK_MAINTENANCE_COMPLETE"] },
    { label: "Audit", permissions: ["VIEW_AUDIT_LOGS", "CONDUCT_AUDIT", "EXPORT_AUDIT_LOGS"] },
    { label: "Reports", permissions: ["VIEW_REPORTS", "GENERATE_REPORTS", "EXPORT_REPORTS"] },
    { label: "Finance", permissions: ["MANAGE_EXPENSES", "VIEW_TCO", "MANAGE_EXCHANGE_RATES", "MANAGE_LEASES", "VIEW_DEPRECIATION", "MANAGE_DEPRECIATION"] },
    { label: "Procurement", permissions: ["VIEW_PROCUREMENT", "MANAGE_PROCUREMENT", "APPROVE_PROCUREMENT"] },
    { label: "Suppliers & Vendors", permissions: ["VIEW_SUPPLIERS", "MANAGE_SUPPLIERS", "VIEW_VENDOR_REVIEWS", "MANAGE_VENDOR_REVIEWS"] },
    { label: "Software & Licenses", permissions: ["VIEW_SOFTWARE_LICENSES", "MANAGE_SOFTWARE_LICENSES"] },
    { label: "Contracts", permissions: ["VIEW_CONTRACTS", "MANAGE_CONTRACTS"] },
    { label: "Compliance", permissions: ["VIEW_COMPLIANCE", "MANAGE_COMPLIANCE"] },
    { label: "Infrastructure", permissions: ["VIEW_NETWORK_DISCOVERY", "MANAGE_NETWORK_DISCOVERY", "VIEW_CLOUD_ASSETS", "MANAGE_CLOUD_ASSETS"] },
    { label: "Roles", permissions: ["VIEW_ROLES", "MANAGE_ROLES"] },
    { label: "Settings & Admin", permissions: ["MANAGE_ORGANIZATION_SETTINGS", "MANAGE_SECURITY_SETTINGS", "REVIEW_ACCESS", "SYSTEM_ADMIN"] },
];

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [allPermissions, setAllPermissions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RoleDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [rolesData, permsData] = await Promise.all([
                roleService.getAll(),
                roleService.getPermissions(),
            ]);
            setRoles(rolesData);
            setAllPermissions(permsData);
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

    // Build the grouped permission list: known groups first, then any extra from the server
    const permissionGroups = (() => {
        const grouped = PERMISSION_GROUPS.map(g => ({
            ...g,
            permissions: g.permissions.filter(p => allPermissions.includes(p)),
        })).filter(g => g.permissions.length > 0);

        const knownPerms = new Set(PERMISSION_GROUPS.flatMap(g => g.permissions));
        const extra = allPermissions.filter(p => !knownPerms.has(p));
        if (extra.length > 0) grouped.push({ label: "Other", permissions: extra });
        return grouped;
    })();

    const { confirm, ConfirmDialog } = useConfirm();
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const parsePermissions = (value: Role["permissions"]): string[] => {
        if (Array.isArray(value)) return value;
        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) return parsed.map(String);
                if (parsed && typeof parsed === "object") {
                    return Object.entries(parsed)
                        .filter(([, enabled]) => Boolean(enabled))
                        .map(([key]) => key);
                }
            } catch {
                return [];
            }
        }
        return [];
    };

    const handleOpenCreate = () => {
        setEditingRole(null);
        setSelectedPermissions([]);
        reset({
            name: "",
            description: "",
            permissions: []
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (role: Role) => {
        // System roles like SUPER_ADMIN usually can't be edited by normal UI flows, but we'll allow viewing
        if (role.systemRole) {
            toast("System roles cannot be modified.", { icon: "🔒" });
            // return; // Commented out to allow exploring the UI
        }
        setEditingRole(role);
        const perms = parsePermissions(role.permissions);
        setSelectedPermissions(perms);
        reset({
            name: role.name,
            description: role.description || "",
            permissions: perms
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (role: Role) => {
        if (role.systemRole) {
            toast.error("System roles cannot be deleted.");
            return;
        }
        if (!await confirm({ message: "Are you sure you want to delete this role? Users with this role might lose access.", variant: "danger" })) return;
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
            data.permissions = selectedPermissions;

            if (editingRole) {
                if (editingRole.isSystemRole) {
                    toast.error("Cannot save edits to a System Role.");
                    return;
                }
                const patch = buildPatchPayload<RoleDto>(editingRole as unknown as Partial<RoleDto>, data);
                if (Object.keys(patch).length === 0) {
                    toast("No changes to update");
                    return;
                }
                await roleService.update(editingRole.id!, patch);
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
                        <PageSpinner />
                    </div>
                ) : roles.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <Shield className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No roles configured</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">Create security roles like &quot;Admin&quot; or &quot;Auditor&quot; to map permissions to your users.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300">
                            Configure First Role
                        </Button>
                    </div>
                ) : (
                    roles.map((role) => (
                        <Card key={role.id} className="overflow-hidden hover:shadow-md transition-all group border-slate-200 flex flex-col relative">
                            {role.systemRole && (
                                <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none" title="System Role - Cannot be deleted">
                                    <div className="absolute top-[-10px] right-[-30px] w-[80px] h-[30px] bg-sky-500 rotate-45 transform origin-bottom-right z-10"></div>
                                    <Lock className="absolute top-[3px] right-[3px] h-3 w-3 text-white z-20 pointer-events-auto" />
                                </div>
                            )}
                            <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="truncate pr-2 w-full">
                                    <div className="flex justify-between items-start mb-1">
                                        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-1.5 truncate pr-6" title={role.name}>
                                            <Shield className={`h-4 w-4 shrink-0 ${role.systemRole ? 'text-sky-600' : 'text-zinc-600'}`} />
                                            <span className="truncate">{role.name}</span>
                                        </CardTitle>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5 ml-5 truncate">
                                        Role Access
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col justify-between">
                                <div className="space-y-3 text-sm text-slate-600 flex-1">
                                    <p className="line-clamp-2" title={role.description}>{role.description || "No description provided."}</p>

                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <div className="text-xs font-semibold uppercase text-slate-400 mb-2">Granted Permissions ({parsePermissions(role.permissions).length})</div>
                                        <div className="flex flex-wrap gap-1">
                                            {parsePermissions(role.permissions).slice(0, 4).map(p => (
                                                <span key={p} className="px-1.5 py-0.5 bg-slate-100 text-[10px] rounded border border-slate-200 text-slate-600 font-mono" title={p}>
                                                    {p.replace('_', ' ')}
                                                </span>
                                            ))}
                                            {parsePermissions(role.permissions).length > 4 && (
                                                <span className="px-1.5 py-0.5 bg-slate-50 text-[10px] rounded border border-slate-200 text-slate-500 font-mono">
                                                    +{parsePermissions(role.permissions).length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end items-center gap-2 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {role.systemRole ? (
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



                    <div className="space-y-2">
                        <Label htmlFor="description">Profile Description</Label>
                        <Textarea id="description" placeholder="Read-only access to POs and Audits..." {...register("description")} disabled={!!(editingRole?.isSystemRole)} />
                    </div>

                    <div className="space-y-3 border-t pt-4 border-b pb-4">
                        <div className="flex items-center justify-between">
                            <Label>Granular Permissions</Label>
                            <span className="text-xs text-slate-400">{selectedPermissions.length} selected</span>
                        </div>
                        <div className="max-h-[280px] overflow-y-auto space-y-4 pr-1">
                            {permissionGroups.map(group => (
                                <div key={group.label}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 px-1">{group.label}</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {group.permissions.map(perm => (
                                            <div key={perm} className="flex items-center space-x-2 px-2 py-1.5 rounded-md hover:bg-slate-100 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    id={`perm-${perm}`}
                                                    className="rounded border-gray-300 text-zinc-600 shadow-sm focus:border-zinc-300 focus:ring focus:ring-zinc-200 focus:ring-opacity-50"
                                                    checked={selectedPermissions.includes(perm)}
                                                    onChange={() => !editingRole?.isSystemRole && togglePermission(perm)}
                                                    disabled={!!(editingRole?.isSystemRole)}
                                                />
                                                <Label htmlFor={`perm-${perm}`} className="text-xs font-mono cursor-pointer leading-tight">
                                                    {perm.replace(/_/g, ' ')}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {permissionGroups.length === 0 && (
                                <p className="text-xs text-slate-400 italic text-center py-4">Loading permissions…</p>
                            )}
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
        {ConfirmDialog}
            </Modal>
        </div>
    );
}
