"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queryClient";
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
    { label: "Employees", permissions: ["VIEW_EMPLOYEES", "MANAGE_EMPLOYEES", "OFFBOARD_EMPLOYEE"] },
    { label: "Roles", permissions: ["VIEW_ROLES", "MANAGE_ROLES"] },
    { label: "Settings & Admin", permissions: ["MANAGE_ORGANIZATION_SETTINGS", "MANAGE_SECURITY_SETTINGS", "REVIEW_ACCESS", "SYSTEM_ADMIN"] },
];

export default function RolesPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RoleDto>();

    const queryClient = useQueryClient();
    const rolesKey = qk.module("roles");
    const { data: roles = [], isLoading } = useQuery({
        queryKey: rolesKey.list(),
        queryFn: () => roleService.getAll(),
    });
    const { data: allPermissions = [] } = useQuery({
        queryKey: [...rolesKey.all, "permissions"],
        queryFn: () => roleService.getPermissions(),
        staleTime: 300_000,
    });
    const invalidate = () => queryClient.invalidateQueries({ queryKey: rolesKey.all });
    const deleteRole = useMutation({
        mutationFn: (id: string) => roleService.delete(id),
        onSuccess: () => { toast.success("Role deleted"); invalidate(); },
        onError: () => toast.error("Failed to delete role"),
    });

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
        deleteRole.mutate(role.id!);
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
                if (editingRole.systemRole) {
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
            invalidate();
        } catch (error) {
            toast.error("Failed to save role");
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Access roles</h1>
                    <p className="text-[13px] text-muted-fg">Role-based access control profiles for your workspace.</p>
                </div>
                <Button onClick={handleOpenCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Create custom role
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <PageSpinner />
                    </div>
                ) : roles.length === 0 ? (
                    <div className="col-span-full bg-surface rounded-card border border-dashed border-edge flex flex-col items-center justify-center p-12 text-center">
                        <Shield className="h-12 w-12 text-faint-fg mb-4" />
                        <h3 className="text-lg font-semibold text-foreground">No roles configured</h3>
                        <p className="text-muted-fg mt-1 max-w-sm">Create security roles like &quot;Admin&quot; or &quot;Auditor&quot; to map permissions to your users.</p>
                        <Button onClick={handleOpenCreate} className="mt-6" variant="outline">
                            Configure first role
                        </Button>
                    </div>
                ) : (
                    roles.map((role) => (
                        <Card key={role.id} className="overflow-hidden hover:shadow-md transition-all group flex flex-col relative">
                            {role.systemRole && (
                                <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none" title="System Role - Cannot be deleted">
                                    <div className="absolute top-[-10px] right-[-30px] w-[80px] h-[30px] bg-brand rotate-45 transform origin-bottom-right z-10"></div>
                                    <Lock className="absolute top-[3px] right-[3px] h-3 w-3 text-white z-20 pointer-events-auto" />
                                </div>
                            )}
                            <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-3 bg-surface-muted border-b border-edge-subtle">
                                <div className="truncate pr-2 w-full">
                                    <div className="flex justify-between items-start mb-1">
                                        <CardTitle className="text-base font-bold text-foreground flex items-center gap-1.5 truncate pr-6" title={role.name}>
                                            <Shield className={`h-4 w-4 shrink-0 ${role.systemRole ? 'text-brand' : 'text-muted-fg'}`} />
                                            <span className="truncate">{role.name}</span>
                                        </CardTitle>
                                    </div>
                                    <div className="text-xs text-faint-fg mt-0.5 ml-5 truncate">
                                        {role.systemRole ? "System role" : "Custom role"}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 flex flex-col justify-between">
                                <div className="space-y-3 text-sm text-muted-fg flex-1">
                                    <p className="line-clamp-2" title={role.description}>{role.description || "No description provided."}</p>

                                    <div className="mt-4 pt-4 border-t border-edge-subtle">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint-fg mb-2">Granted permissions ({parsePermissions(role.permissions).length})</div>
                                        <div className="flex flex-wrap gap-1">
                                            {parsePermissions(role.permissions).slice(0, 4).map(p => (
                                                <span key={p} className="data-mono px-1.5 py-0.5 bg-surface-sunken text-[10px] rounded border border-edge text-muted-fg" title={p}>
                                                    {p.replace('_', ' ')}
                                                </span>
                                            ))}
                                            {parsePermissions(role.permissions).length > 4 && (
                                                <span className="data-mono px-1.5 py-0.5 bg-surface-muted text-[10px] rounded border border-edge text-faint-fg">
                                                    +{parsePermissions(role.permissions).length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end items-center gap-2 pt-4">
                                    {role.systemRole ? (
                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(role)} className="h-8">
                                            <ShieldAlert className="h-3.5 w-3.5 mr-1" /> View System Policy
                                        </Button>
                                    ) : (
                                        <>
                                            <Button variant="outline" size="sm" onClick={() => handleOpenEdit(role)} className="h-8 w-8 p-0">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(role)} className="h-8 w-8 p-0 text-danger">
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
                title={editingRole ? (editingRole.systemRole ? "View System Role Policy" : "Edit Custom Role") : "Create Custom Role"}
                description={editingRole?.systemRole ? "System roles are hardcoded by the application and cannot be structurally altered." : "Define an access control envelope to assign to users."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    {editingRole?.systemRole && (
                        <div className="bg-info-soft text-foreground p-3 rounded-card text-sm mb-4 border border-edge flex items-start gap-2">
                            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-info" />
                            <p><strong>System Defined Profile.</strong> This role is locked. You are viewing it in Read-Only mode.</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="name">Role Name <span className="text-danger">*</span></Label>
                        <Input
                            id="name"
                            placeholder="e.g. Finance Auditor"
                            {...register("name", { required: "Name is required" })}
                            disabled={!!(editingRole?.systemRole)}
                        />
                        {errors.name && <p className="text-sm text-danger">{errors.name.message as string}</p>}
                    </div>



                    <div className="space-y-2">
                        <Label htmlFor="description">Profile Description</Label>
                        <Textarea id="description" placeholder="Read-only access to POs and Audits..." {...register("description")} disabled={!!(editingRole?.systemRole)} />
                    </div>

                    <div className="space-y-3 border-t border-edge-subtle pt-4 border-b pb-4">
                        <div className="flex items-center justify-between">
                            <Label>Granular Permissions</Label>
                            <span className="data-mono text-xs text-faint-fg">{selectedPermissions.length} selected</span>
                        </div>
                        <div className="max-h-[280px] overflow-y-auto space-y-4 pr-1">
                            {permissionGroups.map(group => (
                                <div key={group.label}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-faint-fg mb-1.5 px-1">{group.label}</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {group.permissions.map(perm => (
                                            <div key={perm} className="flex items-center space-x-2 px-2 py-1.5 rounded-md hover:bg-surface-sunken transition-colors">
                                                <input
                                                    type="checkbox"
                                                    id={`perm-${perm}`}
                                                    className="ea-focus rounded border-edge accent-[var(--primary)]"
                                                    checked={selectedPermissions.includes(perm)}
                                                    onChange={() => !editingRole?.systemRole && togglePermission(perm)}
                                                    disabled={!!(editingRole?.systemRole)}
                                                />
                                                <Label htmlFor={`perm-${perm}`} className="data-mono text-xs cursor-pointer leading-tight">
                                                    {perm.replace(/_/g, ' ')}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {permissionGroups.length === 0 && (
                                <p className="text-xs text-faint-fg italic text-center py-4">Loading permissions…</p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            {editingRole?.systemRole ? "Close" : "Cancel"}
                        </Button>
                        {!editingRole?.systemRole && (
                            <Button type="submit" isLoading={isSubmitting}>
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
