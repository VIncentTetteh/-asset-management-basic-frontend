import { describe, expect, it } from "vitest";
import { managerChoices } from "@/features/employees/EmployeeFormModal";
import type { EmployeeDto } from "@/services/employeeService";

const emp = (id: string, first: string, extra: Partial<EmployeeDto> = {}): EmployeeDto =>
    ({ id, firstName: first, lastName: "X", ...extra }) as EmployeeDto;

describe("managerChoices", () => {
    it("excludes the employee being edited", () => {
        const choices = managerChoices([emp("a", "Ama"), emp("b", "Kofi")], emp("a", "Ama"));
        expect(choices.map((c) => c.id)).toEqual(["b"]);
    });

    it("keeps a current manager that is not in the loaded list", () => {
        const editing = emp("a", "Ama", { managerId: "z", managerName: "Old Boss" });
        const choices = managerChoices([emp("b", "Kofi")], editing);
        expect(choices[0]).toEqual({ id: "z", label: "Old Boss" });
    });

    it("offers everyone on create", () => {
        expect(managerChoices([emp("a", "Ama"), emp("b", "Kofi")], null)).toHaveLength(2);
    });
});
