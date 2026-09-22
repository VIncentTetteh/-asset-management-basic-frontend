"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { Department, User } from "@/types";
import type { EmployeeDto } from "@/services/employeeService";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSaveEmployee } from "@/features/employees/hooks";
import { applyApiFieldErrors } from "@/lib/api-validation";
import { todayLocal } from "@/lib/local-date";

export function EmployeeFormModal({
  isOpen,
  onClose,
  editingEmployee,
  departments,
  users,
  employees = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  editingEmployee: EmployeeDto | null;
  departments: Department[];
  users: User[];
  /** Manager candidates (active employees). */
  employees?: EmployeeDto[];
}) {
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<EmployeeDto>();
  const save = useSaveEmployee();
  const managerOptions = managerChoices(employees, editingEmployee);

  useEffect(() => {
    if (!isOpen) return;
    reset(
      editingEmployee
        ? {
            employeeNumber: editingEmployee.employeeNumber || "",
            firstName: editingEmployee.firstName,
            lastName: editingEmployee.lastName,
            email: editingEmployee.email || "",
            phone: editingEmployee.phone || "",
            jobTitle: editingEmployee.jobTitle || "",
            departmentId: editingEmployee.departmentId || "",
            managerId: editingEmployee.managerId || "",
            userId: editingEmployee.userId || "",
            status: editingEmployee.status,
            hireDate: editingEmployee.hireDate || "",
            notes: editingEmployee.notes || "",
          }
        : {
            employeeNumber: "",
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            jobTitle: "",
            departmentId: "",
            managerId: "",
            userId: "",
            hireDate: todayLocal(),
            notes: "",
          },
    );
  }, [isOpen, editingEmployee, reset]);

  const onSubmit = async (data: EmployeeDto) => {
    const payload: EmployeeDto = { ...data };
    (Object.keys(payload) as (keyof EmployeeDto)[]).forEach((k) => {
      if (payload[k] === "") delete (payload as unknown as Record<string, unknown>)[k];
    });
    // Status transitions happen through onboarding/offboarding, not the form.
    if (!editingEmployee) delete payload.status;

    try {
      await save.mutateAsync({ id: editingEmployee?.id, data: payload });
      onClose();
    } catch (err) {
      // Toasted by the mutation; keep the form open with the fields marked.
      applyApiFieldErrors(err, setError);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingEmployee ? "Edit employee" : "New employee"}
      description={
        editingEmployee
          ? "Update this employee's record."
          : "An employee can hold assets without needing a system login."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emp-first">First name <span className="text-danger">*</span></Label>
            <Input id="emp-first" placeholder="Ama" {...register("firstName", { required: "First name is required" })} />
            {errors.firstName && <p className="text-sm text-danger">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-last">Last name <span className="text-danger">*</span></Label>
            <Input id="emp-last" placeholder="Mensah" {...register("lastName", { required: "Last name is required" })} />
            {errors.lastName && <p className="text-sm text-danger">{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emp-number">Employee number</Label>
            <Input id="emp-number" placeholder="EMP-0001" className="data-mono" maxLength={100} {...register("employeeNumber")} />
            {errors.employeeNumber && <p className="text-sm text-danger">{errors.employeeNumber.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-title">Job title</Label>
            <Input id="emp-title" placeholder="Field Engineer" {...register("jobTitle")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emp-email">Email</Label>
            <Input id="emp-email" type="email" placeholder="ama.mensah@example.com" {...register("email")} />
            {errors.email && <p className="text-sm text-danger">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-phone">Phone</Label>
            <Input id="emp-phone" placeholder="+233 …" {...register("phone")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emp-dept">Department</Label>
            <Select id="emp-dept" {...register("departmentId")}>
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-hire">Hire date</Label>
            <Input id="emp-hire" type="date" {...register("hireDate")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="emp-manager">Manager</Label>
          <Select id="emp-manager" {...register("managerId")}>
            <option value="">None</option>
            {managerOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </Select>
          {errors.managerId && <p className="text-sm text-danger">{errors.managerId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="emp-user">Linked system user (optional)</Label>
          <Select id="emp-user" {...register("userId")}>
            <option value="">No login — asset custodian only</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="emp-notes">Notes</Label>
          <Textarea id="emp-notes" placeholder="Contract type, work location, remarks…" {...register("notes")} />
        </div>

        <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={save.isPending}>
            {editingEmployee ? "Save changes" : "Create employee"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Employees who can be picked as this employee's manager: never the employee
 * themself, and always the current manager (even when not in the loaded page,
 * e.g. a terminated manager) so an edit does not silently drop them.
 */
export function managerChoices(
  employees: EmployeeDto[],
  editing: EmployeeDto | null,
): { id: string; label: string }[] {
  const options = employees
    .filter((e) => e.id && e.id !== editing?.id)
    .map((e) => ({ id: e.id as string, label: `${e.firstName} ${e.lastName}` }));
  if (editing?.managerId && !options.some((o) => o.id === editing.managerId)) {
    options.unshift({ id: editing.managerId, label: editing.managerName || "Current manager" });
  }
  return options;
}
