import { describe, expect, it } from "vitest";
import { importJobPhase, shouldPollImportJob } from "@/features/assets/importJob";

describe("importJobPhase", () => {
    it.each([
        ["QUEUED", "running"],
        ["PROCESSING", "running"],
        ["COMPLETED", "completed"],
        ["FAILED", "failed"],
        ["CANCELLED", "cancelled"],
        [undefined, "running"],
    ] as const)("%s -> %s", (status, phase) => {
        expect(importJobPhase(status)).toBe(phase);
    });
});

describe("shouldPollImportJob", () => {
    it("polls a queued job (the status the API returns on upload)", () => {
        expect(shouldPollImportJob("job-1", "QUEUED")).toBe(true);
    });
    it("stops on every terminal status", () => {
        for (const s of ["COMPLETED", "FAILED", "CANCELLED"]) {
            expect(shouldPollImportJob("job-1", s)).toBe(false);
        }
    });
    it("does not poll without a job id", () => {
        expect(shouldPollImportJob(null, "QUEUED")).toBe(false);
    });
});
