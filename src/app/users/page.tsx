"use client";

import { useState, useEffect, useMemo } from "react";
import { User, UserDto, Department, Role } from "@/types";
import { userService } from "@/services/userService";
import { departmentService } from "@/services/departmentService";
import { roleService } from "@/services/roleService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, UserX, UsersIcon, Shield, Layers, Briefcase, Mail, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [usersData, deptsData, rolesData] = await Promise.all([
                userService.getAll(),
                departmentService.getAll(),
                roleService.getAll()
            ]);
            setUsers(usersData);
            setDepartments(deptsData);
            setRoles(rolesData);
        } catch (error) {
            toast.error("Failed to load users");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
    const roleMap = useMemo(() => new Map(roles.map(r => [r.id, r.name])), [roles]);

    const handleOpenCreate = () => {
        setEditingUser(null);
        reset({
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            jobTitle: "",
            departmentId: "",
            roleId: "",
            password: "",
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (user: User) => {
        setEditingUser(user);
        reset({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone || "",
            jobTitle: user.jobTitle || "",
            departmentId: user.departmentId || "",
            roleId: user.roleId || "",
        });
        setIsModalOpen(true);
    };

    const handleDeactivate = async (user: User) => {
        if (!confirm(`Deactivate ${user.firstName} ${user.lastName}? They will lose access.`)) return;
        try {
            await userService.deactivate(user.id!);
            toast.success("User deactivated");
            fetchData();
        } catch (error) {
            toast.error("Failed to deactivate user");
            console.error(error);
        }
    };

    const onSubmit = async (data: UserDto) => {
        const payload: UserDto = {
            ...data,
            phone: data.phone || undefined,
            jobTitle: data.jobTitle || undefined,
            departmentId: data.departmentId || undefined,
            roleId: data.roleId || undefined,
        };

        try {
            if (editingUser) {
                const { password, ...updateData } = payload;
                const { roleId, ...profileData } = updateData;

                // Update base profile fields first.
                await userService.update(editingUser.id!, profileData);

                // Role changes must go through /users/{id}/role.
                if (roleId && roleId !== editingUser.roleId) {
                    await userService.assignRole(editingUser.id!, roleId);
                }

                toast.success("Profile updated");
            } else {
                if (!payload.password) {
                    toast.error("Password is required");
                    return;
                }
                await userService.create({
                    ...(payload as UserDto & { password: string }),
                    organisationId: payload.organisationId || getOrganisationIdFromStorage(),
                    status: payload.status || "ACTIVE",
                });
                toast.success("User created successfully");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to save profile");
            console.error(error);
        }
    };

    const getStatusStyles = (status?: string) => {
        switch (status) {
            case "ACTIVE": return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case "INACTIVE": return "bg-slate-100 text-slate-500 border-slate-200";
            case "SUSPENDED": return "bg-amber-100 text-amber-700 border-amber-200";
            default: return "bg-slate-100 text-slate-500 border-slate-200";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Personnel & Staff</h1>
                    <p className="text-slate-500">Manage user access, directories, and department assignments.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-sky-700 hover:bg-sky-800">
                    <Plus className="mr-2 h-4 w-4" /> Provision User
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700"></div>
                    </div>
                ) : users.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <UsersIcon className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No users provisioned</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">Invite employees to the platform to start assigning them assets.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-300">
                            Provision User
                        </Button>
                    </div>
                ) : (
                    users.map((user) => (
                        <Card key={user.id} className="overflow-hidden hover:shadow-md transition-all group border-slate-200 flex flex-col pt-2">
                            <CardHeader className="flex flex-col space-y-2 pb-3 bg-white border-b border-slate-100">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center h-10 w-10 min-w-10 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-400 text-white font-bold text-sm shadow-sm ring-2 ring-white">
                                            {user.firstName[0]}{user.lastName[0]}
                                        </div>
                                        <div className="flex flex-col truncate">
                                            <CardTitle className="text-base font-semibold text-slate-900 truncate" title={`${user.firstName} ${user.lastName}`}>
                                                {user.firstName} {user.lastName}
                                            </CardTitle>
                                            <div className="text-xs text-slate-500 truncate">{user.jobTitle || "Employee"}</div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${getStatusStyles(user.status)}`}>
                                        {user.status || "ACTIVE"}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 flex flex-col bg-slate-50/50">
                                <div className="space-y-0 text-sm text-slate-600 flex-1 divide-y divide-slate-100">
                                    <div className="px-4 py-2.5 flex items-center gap-2.5 truncate">
                                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <a href={`mailto:${user.email}`} className="truncate text-sky-600 hover:underline text-xs font-medium">{user.email}</a>
                                    </div>
                                    <div className="px-4 py-2.5 flex items-center gap-2.5 truncate">
                                        <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate text-xs text-slate-600">{deptMap.get(user.departmentId || "") || "Unassigned"}</span>
                                    </div>
                                    <div className="px-4 py-2.5 flex items-center gap-2.5 truncate">
                                        <Shield className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                        <span className="truncate text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                            {roleMap.get(user.roleId || "") || "No Role"}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 p-3 bg-white border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(user)} className="h-8">
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeactivate(user)}
                                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        title="Deactivate user"
                                        disabled={user.status === "INACTIVE"}
                                    >
                                        <UserX className="h-3.5 w-3.5" />
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
                title={editingUser ? "Update Staff Profile" : "Provision New User"}
                description={editingUser ? "Modify the user's directory information." : "Onboard a new employee to the system."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                            <Input id="firstName" placeholder="John" {...register("firstName", { required: "First name required" })} />
                            {errors.firstName && <p className="text-sm text-red-500">{errors.firstName.message as string}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                            <Input id="lastName" placeholder="Doe" {...register("lastName", { required: "Last name required" })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                            <Input id="email" type="email" placeholder="john@acme.com" {...register("email", { required: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" placeholder="+233244000000" {...register("phone")} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="jobTitle">Job Title</Label>
                        <Input id="jobTitle" placeholder="Store Manager" {...register("jobTitle")} />
                    </div>

                    {/* Password — only shown on create */}
                    {!editingUser && (
                        <div className="space-y-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
                            <Label htmlFor="password" className="flex items-center gap-1.5 text-amber-900">
                                <Lock className="h-4 w-4 text-amber-600" /> Password <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Min 8 characters"
                                {...register("password", { required: !editingUser ? "Password is required" : false, minLength: { value: 8, message: "Min 8 characters" } })}
                            />
                            {errors.password && <p className="text-sm text-red-500">{errors.password.message as string}</p>}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mt-2">
                        <div className="col-span-full mb-1">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-slate-400" /> Structure & Assignments</h4>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="departmentId" className="text-xs">Department</Label>
                            <Select id="departmentId" {...register("departmentId")}>
                                <option value="">Select Department</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="col-span-full space-y-2">
                            <Label htmlFor="roleId" className="text-indigo-900 flex items-center gap-1.5"><Shield className="h-4 w-4 text-indigo-400" /> Role</Label>
                            <Select id="roleId" {...register("roleId")}>
                                <option value="">Grant Role (defaults to USER)</option>
                                {roles.map((role) => (
                                    <option key={role.id} value={role.id}>{role.name}</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-sky-700 hover:bg-sky-800">
                            {editingUser ? "Save Updates" : "Issue Credentials"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
