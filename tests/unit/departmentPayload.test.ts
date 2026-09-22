import { describe, expect, it } from "vitest";
import { buildDepartmentPayload, DEPARTMENT_STATUSES } from "@/features/departments/departmentPayload";
import type { Department, DepartmentDto } from "@/types";

const existing = {
    id: "d1", name: "Finance", description: "Money", departmentCode: "FIN", costCenterCode: "CC1", budgetLimit: 500, status: "ACTIVE",
} as Department;

const form = (o: Partial<Record<keyof DepartmentDto, unknown>> = {}): DepartmentDto => ({
    name: "Finance", description: "Money", departmentCode: "FIN", costCenterCode: "CC1",
    budgetLimit: "500" as unknown as number, status: "ACTIVE", ...o,
}) as DepartmentDto;

describe("department payload", () => {
    it("sends nothing for an untouched edit", () => {
        expect(buildDepartmentPayload(form(), existing)).toEqual({});
    });

    it("sends an emptied description as an explicit clear", () => {
        expect(buildDepartmentPayload(form({ description: "  " }), existing)).toEqual({ description: "" });
    });

    it("archives a department", () => {
        expect(buildDepartmentPayload(form({ status: "ARCHIVED" }), existing)).toEqual({ status: "ARCHIVED" });
        expect(DEPARTMENT_STATUSES.map((s) => s.value)).toContain("ARCHIVED");
    });

    it("omits blanks on create but keeps the description", () => {
        expect(buildDepartmentPayload(form({ description: "New team", departmentCode: "", costCenterCode: "", budgetLimit: "" })))
            .toEqual({ name: "Finance", description: "New team", status: "ACTIVE" });
    });
});
