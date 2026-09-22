import { describe, expect, it } from "vitest";
import { organisationFormValues, organisationPatch } from "@/features/organisations/OrganisationFormModal";
import type { Organisation } from "@/types";

const org = {
    id: "o1", name: "Acme", registrationNumber: "REG-1", taxId: "TAX-1", contactEmail: "ops@acme.com",
    timezone: "Africa/Accra", dpoName: "Efua", dataResidencyRegion: "GH",
} as Organisation;

describe("organisation form", () => {
    it("starts from the stored values, blanks as empty strings and residency GH by default", () => {
        const values = organisationFormValues({ id: "o2", name: "Beta" } as Organisation);
        expect(values.taxId).toBe("");
        expect(values.dataResidencyRegion).toBe("GH");
    });

    it("sends only changed fields, trimmed, and a cleared field as an empty string", () => {
        const initial = organisationFormValues(org);
        const patch = organisationPatch(initial, {
            ...initial, taxId: "", dpoEmail: " dpo@acme.com ", timezone: "Europe/London",
        });
        expect(patch).toEqual({ taxId: "", dpoEmail: "dpo@acme.com", timezone: "Europe/London" });
    });

    it("sends nothing when nothing changed", () => {
        const initial = organisationFormValues(org);
        expect(organisationPatch(initial, { ...initial, name: " Acme " })).toEqual({});
    });
});
