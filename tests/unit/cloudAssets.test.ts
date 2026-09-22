import { describe, expect, it } from "vitest";
import {
    CLOUD_ENVIRONMENTS,
    CLOUD_RESOURCE_TYPES,
    buildCloudAssetPayload,
    buildCloudCostPayload,
    formatBillingMonth,
} from "@/features/cloud/options";

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

describe("cloud cost records", () => {
    it("a blank service name is null (the whole asset)", () => {
        expect(buildCloudCostPayload({ billingMonth: "2026-09", amount: "12.5", serviceName: "  " }))
            .toEqual({ billingMonth: "2026-09", amount: 12.5, serviceName: null });
        expect(buildCloudCostPayload({ billingMonth: "2026-09", amount: 3, serviceName: " EC2 " }).serviceName).toBe("EC2");
    });

    it("formats a billing month without a time-zone shift", () => {
        expect(formatBillingMonth("2026-01")).toBe("Jan 2026");
        expect(formatBillingMonth(null)).toBe("—");
    });
});
