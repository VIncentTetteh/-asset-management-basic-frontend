import { describe, expect, it } from "vitest";
import { buildUserProfileUpdate, roleChangeFor } from "@/features/users/payload";

describe("user edit payload", () => {
    it("sends a full profile, nulling cleared fields and carrying the employee id", () => {
        expect(
            buildUserProfileUpdate(
                { email: "ama@example.com", employeeId: "EMP-7" },
                { firstName: " Ama ", lastName: "Mensah", email: "ignored@example.com", phone: "", jobTitle: "", departmentId: "" },
            ),
        ).toEqual({
            firstName: "Ama",
            lastName: "Mensah",
            email: "ama@example.com",
            phone: null,
            jobTitle: null,
            employeeId: "EMP-7",
            departmentId: null,
        });
    });

    it("only asks for a role change when the picker differs from the current role", () => {
        expect(roleChangeFor("r1", "r1")).toBeNull();
        expect(roleChangeFor("r1", "r2")).toBe("r2");
        expect(roleChangeFor(undefined, "r2")).toBe("r2");
    });

    it("asks to remove the role when the picker is cleared", () => {
        expect(roleChangeFor("r1", "")).toBe("clear");
        expect(roleChangeFor("r1", undefined)).toBe("clear");
        // Nothing to remove when there was no role to begin with.
        expect(roleChangeFor(undefined, "")).toBeNull();
    });
});
