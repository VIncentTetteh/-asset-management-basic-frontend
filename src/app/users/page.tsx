"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Pencil, UserX, UserPlus, ShieldOff, Search } from "lucide-react";
import type { User, UserDto } from "@/types";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { useConfirm } from "@/hooks/useConfirm";
import { getOrganisationIdFromStorage } from "@/lib/authContext";
import {
  useUsers,
  useUserMasterData,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
  useResetMfa,
} from "@/features/users/hooks";

export default function UsersPage() {
  const { data: users = [], isLoading } = useUsers();
  const master = useUserMasterData();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivate = useDeactivateUser();
  const resetMfa = useResetMfa();
  const { confirm, ConfirmDialog } = useConfirm();

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserDto>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editingUser
        ? {
            firstName: editingUser.firstName,
            lastName: editingUser.lastName,
            email: editingUser.email,
            phone: editingUser.phone || "",
            jobTitle: editingUser.jobTitle || "",
            departmentId: editingUser.departmentId || "",
            roleId: editingUser.roleId || "",
          }
        : {
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            jobTitle: "",
            departmentId: "",
            roleId: "",
            password: "",
          },
    );
  }, [isModalOpen, editingUser, reset]);

  const lookups = useMemo(() => {
    const deptMap = new Map(master.departments.map((d) => [d.id, d.name]));
    const roleMap = new Map(master.roles.map((r) => [r.id, r.name]));
    return {
      deptName: (id?: string) => deptMap.get(id ?? "") ?? "—",
      roleName: (id?: string) => roleMap.get(id ?? "") ?? "—",
    };
  }, [master.departments, master.roles]);

  const filtered = useMemo(() => {
    if (!searchTerm) return users;
    const q = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.jobTitle || "").toLowerCase().includes(q),
    );
  }, [users, searchTerm]);

  const openCreate = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleDeactivate = async (user: User) => {
    if (
      !(await confirm({
        message: `Deactivate ${user.firstName} ${user.lastName}? They will lose access.`,
        variant: "warning",
      }))
    )
      return;
    deactivate.mutate(user.id!);
  };

  const handleResetMfa = async (user: User) => {
    if (
      !(await confirm({
        message: `Reset MFA for ${user.firstName} ${user.lastName}? They can re-enrol at next login.`,
        variant: "warning",
      }))
    )
      return;
    resetMfa.mutate(user.id!);
  };

  const onSubmit = async (data: UserDto) => {
    const payload: UserDto = {
      ...data,
      phone: data.phone || undefined,
      jobTitle: data.jobTitle || undefined,
      departmentId: data.departmentId || undefined,
      roleId: data.roleId || undefined,
    };

    if (editingUser) {
      await updateUser.mutateAsync({ existing: editingUser, data: payload });
    } else {
      if (!payload.password) {
        toast.error("Password is required");
        return;
      }
      await createUser.mutateAsync({
        ...(payload as UserDto & { password: string }),
        organisationId: payload.organisationId || getOrganisationIdFromStorage() || undefined,
        status: payload.status || "ACTIVE",
      });
    }
    setIsModalOpen(false);
  };

  const columns = useMemo<ColumnDef<User, unknown>[]>(
    () => [
      {
        accessorKey: "lastName",
        header: "User",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
              {row.original.firstName[0]}
              {row.original.lastName[0]}
            </div>
            <div className="min-w-0 max-w-48">
              <p className="truncate font-semibold text-foreground">
                {row.original.firstName} {row.original.lastName}
              </p>
              <p className="truncate text-xs text-faint-fg">{row.original.jobTitle || "—"}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => <span className="text-muted-fg">{row.original.email}</span>,
      },
      {
        id: "role",
        header: "Role",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{lookups.roleName(row.original.roleId)}</span>,
      },
      {
        id: "department",
        header: "Department",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{lookups.deptName(row.original.departmentId)}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "ACTIVE"} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Edit user"
              title="Edit"
              onClick={() => {
                setEditingUser(row.original);
                setIsModalOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-warn"
              aria-label="Reset MFA"
              title="Reset MFA"
              onClick={() => handleResetMfa(row.original)}
            >
              <ShieldOff className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger"
              aria-label="Deactivate user"
              title="Deactivate"
              onClick={() => handleDeactivate(row.original)}
            >
              <UserX className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookups],
  );

  return (
    <ListPageTemplate
      title="Users"
      subtitle={isLoading ? "Loading users…" : `${users.length} accounts with platform access`}
      actions={
        <Button onClick={openCreate}>
          <UserPlus className="mr-2 h-4 w-4" /> Provision user
        </Button>
      }
      toolbar={
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
          <Input
            placeholder="Search name, email, or title…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      }
    >
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No users provisioned"
        emptyDescription="Give teammates access to the platform; asset custodians without logins live under Employees."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Provision user
          </Button>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? "Edit user" : "Provision user"}
        description={editingUser ? "Update profile and role." : "Create a login for a teammate."}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="us-first">First name <span className="text-danger">*</span></Label>
              <Input id="us-first" {...register("firstName", { required: "First name is required" })} />
              {errors.firstName && <p className="text-sm text-danger">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="us-last">Last name <span className="text-danger">*</span></Label>
              <Input id="us-last" {...register("lastName", { required: "Last name is required" })} />
              {errors.lastName && <p className="text-sm text-danger">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="us-email">Email <span className="text-danger">*</span></Label>
            <Input id="us-email" type="email" disabled={!!editingUser} {...register("email", { required: "Email is required" })} />
            {errors.email && <p className="text-sm text-danger">{errors.email.message}</p>}
          </div>

          {!editingUser && (
            <div className="space-y-2">
              <Label htmlFor="us-password">Temporary password <span className="text-danger">*</span></Label>
              <Input id="us-password" type="password" {...register("password", { required: !editingUser })} />
              {errors.password && <p className="text-sm text-danger">Password is required</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="us-phone">Phone</Label>
              <Input id="us-phone" {...register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="us-title">Job title</Label>
              <Input id="us-title" {...register("jobTitle")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="us-dept">Department</Label>
              <Select id="us-dept" {...register("departmentId")}>
                <option value="">None</option>
                {master.departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="us-role">Role</Label>
              <Select id="us-role" {...register("roleId")}>
                <option value="">None</option>
                {master.roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createUser.isPending || updateUser.isPending}>
              {editingUser ? "Save changes" : "Create user"}
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
