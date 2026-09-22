import { describe, expect, it } from "vitest";
import {
    MAX_PRESIGN_MINUTES,
    buildStoragePayload,
    bucketNameError,
    presignMinutesError,
    storageFormFromResponse,
} from "@/services/storageConfigService";
import { FIELD_LIMITS } from "@/lib/field-limits";

const response = {
    s3Enabled: true, bucketName: "assetiq-global", bucketOverride: null, defaultBucket: "assetiq-global",
    reportPrefix: "reports", importPrefix: "imports", presignMinutes: 15,
};

describe("storage settings form", () => {
    it("never pre-fills the default bucket as an override", () => {
        expect(storageFormFromResponse(response).bucketName).toBe("");
        // Saving the untouched form keeps using the default.
        expect(buildStoragePayload(storageFormFromResponse(response)).bucketName).toBe("");
    });

    it("keeps a real override", () => {
        expect(storageFormFromResponse({ ...response, bucketOverride: "org-bucket", bucketName: "org-bucket" }).bucketName)
            .toBe("org-bucket");
    });

    it("the TTL range matches the API (1 to 720)", () => {
        expect(MAX_PRESIGN_MINUTES).toBe(720);
        expect(FIELD_LIMITS.storageConfig.presignMinutes.max).toBe(720);
        expect(presignMinutesError(720)).toBeNull();
        expect(presignMinutesError(721)).toMatch(/1 to 720/);
        expect(presignMinutesError(0)).toMatch(/1 to 720/);
        expect(presignMinutesError(1.5)).toMatch(/whole/);
    });

    describe("bucketNameError mirrors the API's S3 naming rule", () => {
        it.each(["", "   ", "abc", "my-org.assets-01", " padded-bucket ", "a".repeat(63)])("accepts %j", (name) => {
            expect(bucketNameError(name)).toBeNull();
        });

        it.each(["ab", "a".repeat(64), "My-Bucket", "-leading", "trailing-", "under_score", "has space"])(
            "rejects %j",
            (name) => {
                expect(bucketNameError(name)).toMatch(/valid S3 bucket name/);
            },
        );

        it("keeps the input limit at the rule's 63 characters", () => {
            expect(FIELD_LIMITS.storageConfig.bucketName.maxLength).toBe(63);
        });
    });
});
