import { describe, expect, it } from "vitest";
import { CLOUD_ENVIRONMENTS, CLOUD_RESOURCE_TYPES, buildCloudAssetPayload } from "@/features/cloud/options";

const base = {
    name: " web-01 ", provider: "AWS" as const, region: "eu-west-1", resourceId: "i-1",
    resourceType: "VIRTUAL_MACHINE" as const, status: "RUNNING" as const,
};

describe("buildCloudAssetPayload", () => {
    it("sends a blank environment as null, never PROD", () => {
        expect(buildCloudAssetPayload({ ...base, environment: "" }).environment).toBeNull();
    });

    it("keeps a chosen environment and trims text", () => {
        const p = buildCloudAssetPayload({ ...base, environment: "TEST", accountId: " ", monthlyCostEstimate: "12.5" });
        expect(p).toMatchObject({ name: "web-01", environment: "TEST", accountId: null, monthlyCostEstimate: 12.5 });
    });

    it("a blank or NaN cost estimate is null", () => {
        expect(buildCloudAssetPayload({ ...base, monthlyCostEstimate: "" }).monthlyCostEstimate).toBeNull();
        expect(buildCloudAssetPayload({ ...base, monthlyCostEstimate: Number.NaN }).monthlyCostEstimate).toBeNull();
    });
});

describe("cloud options mirror the API enums", () => {
    it("offers all five environments", () => {
        expect(CLOUD_ENVIRONMENTS).toEqual(["PROD", "STAGING", "DEV", "TEST", "OTHER"]);
    });

    it("offers all fourteen resource types, including the five that were missing", () => {
        expect(CLOUD_RESOURCE_TYPES).toHaveLength(14);
        expect(CLOUD_RESOURCE_TYPES).toEqual(expect.arrayContaining(["CDN", "DNS", "VPN_GATEWAY", "CACHE", "MESSAGE_QUEUE"]));
    });
});
