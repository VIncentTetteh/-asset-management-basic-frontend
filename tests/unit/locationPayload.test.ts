import { describe, expect, it } from "vitest";
import { allowedParents, buildLocationPayload } from "@/features/locations/payload";

describe("location payload", () => {
    it("sends a full record, clearing the parent and carrying coordinates", () => {
        const body = buildLocationPayload(
            { name: " HQ ", building: "", floor: "2", parentLocationId: "" },
            { id: "l1", name: "HQ", latitude: 5.6, longitude: -0.2, geoCoordinates: "5.6,-0.2" } as never,
        );
        expect(body).toMatchObject({ name: "HQ", floor: "2", parentLocationId: null, latitude: 5.6, longitude: -0.2 });
        expect(body.building).toBeUndefined();
    });

    it("never offers a location or its descendants as its own parent", () => {
        const all = [
            { id: "a", parentLocationId: null },
            { id: "b", parentLocationId: "a" },
            { id: "c", parentLocationId: "b" },
            { id: "d", parentLocationId: null },
        ];
        expect([...allowedParents(all, "a")].sort()).toEqual(["d"]);
        expect([...allowedParents(all, "c")].sort()).toEqual(["a", "b", "d"]);
    });
});

describe("location country", () => {
    it("maps stored names and lower-case codes to ISO codes, keeping legacy text visible", async () => {
        const { toCountryCode, isCountryCode } = await import("@/lib/countries");
        expect(toCountryCode("gh")).toBe("GH");
        expect(toCountryCode("Ghana")).toBe("GH");
        expect(toCountryCode("Head office region")).toBe("Head office region");
        expect(toCountryCode(null)).toBe("");
        expect(isCountryCode("GH")).toBe(true);
        expect(isCountryCode("Ghana")).toBe(false);
    });

    it("clears the country when the blank option is chosen", () => {
        expect(buildLocationPayload({ name: "HQ", country: "" }).country).toBeUndefined();
    });
});
