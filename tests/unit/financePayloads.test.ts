import { describe, expect, it } from "vitest";
import {
    budgetAvailable,
    buildBudgetPayload,
    buildContractPayload,
    buildLeasePayload,
    buildLicensePayload,
    buildPurchaseOrderPayload,
    expenseCurrencyFor,
} from "@/features/finance/payloads";
import { poActionsFor } from "@/features/finance/purchaseOrderWorkflow";
import { LICENSE_TYPES } from "@/types";

describe("budget payload", () => {
    const form = {
        name: " IT hardware ",
        status: "DRAFT",
        totalAmount: "5000",
        currency: "GHS",
        fiscalYear: "",
        departmentId: "",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        alertThresholdPct: "75",
    };

    it("always sends the required period dates and the alert threshold", () => {
        expect(buildBudgetPayload(form)).toEqual({
            name: "IT hardware",
            description: null,
            status: "DRAFT",
            totalAmount: 5000,
            currency: "GHS",
            fiscalYear: null,
            departmentId: null,
            periodStart: "2026-01-01",
            periodEnd: "2026-12-31",
            alertThresholdPct: 75,
        });
    });

    it("never sends spent or committed amounts", () => {
        const payload = buildBudgetPayload({ ...form, spentAmount: "0" } as never);
        expect(payload).not.toHaveProperty("spentAmount");
        expect(payload).not.toHaveProperty("committedAmount");
    });

    it("keeps an empty date as an empty string so the API reports it, instead of dropping the key", () => {
        expect(buildBudgetPayload({ ...form, periodStart: "" })).toHaveProperty("periodStart", "");
    });

    it("computes available as total minus spent minus committed", () => {
        expect(budgetAvailable({ totalAmount: 1000, spentAmount: 300, committedAmount: 200 } as never)).toBe(500);
        expect(budgetAvailable({ totalAmount: 1000, spentAmount: 300, committedAmount: 200, availableAmount: 450 })).toBe(450);
    });
});

describe("purchase order payload", () => {
    it("carries the linked budget and never a status", () => {
        const payload = buildPurchaseOrderPayload({
            poNumber: " PO-7 ",
            totalAmount: "250.5",
            currency: "GHS",
            departmentId: "d1",
            supplierId: "s1",
            linkedBudgetId: "b1",
            status: "APPROVED",
        } as never);
        expect(payload).toEqual({
            poNumber: "PO-7",
            totalAmount: 250.5,
            currency: "GHS",
            remarks: undefined,
            departmentId: "d1",
            supplierId: "s1",
            linkedBudgetId: "b1",
        });
        expect(payload).not.toHaveProperty("status");
    });

    it("sends null for an emptied budget so PUT unlinks it", () => {
        expect(buildPurchaseOrderPayload({ poNumber: "PO-1", linkedBudgetId: "" }).linkedBudgetId).toBeNull();
    });

    it("offers only the transitions the backend allows", () => {
        expect(poActionsFor("DRAFT")).toEqual(["submit", "cancel", "delete"]);
        expect(poActionsFor("SUBMITTED")).toEqual(["approve", "reject", "cancel", "delete"]);
        expect(poActionsFor("APPROVED")).toEqual(["receive", "cancel", "delete"]);
        expect(poActionsFor("DELIVERED")).toEqual(["delete"]);
        expect(poActionsFor("APPROVED")).not.toContain("reject");
    });
});

describe("lease payload", () => {
    it("sends the lessor as a supplier id, not free text", () => {
        const payload = buildLeasePayload({
            assetId: "a1",
            lessorId: "sup-1",
            lessorName: "LeaseCo",
            startDate: "2026-01-01",
            endDate: "2027-01-01",
            monthlyPayment: "300",
            currency: "GHS",
            autoRenew: true,
            noticePeriodDays: "60",
            notes: "",
        } as never);
        expect(payload).toEqual({
            assetId: "a1",
            lessorId: "sup-1",
            startDate: "2026-01-01",
            endDate: "2027-01-01",
            monthlyPayment: 300,
            currency: "GHS",
            autoRenew: true,
            noticePeriodDays: 60,
            notes: undefined,
        });
        expect(payload).not.toHaveProperty("lessorName");
    });
});

describe("license payload", () => {
    it("uses SoftwareLicenseDto field names", () => {
        const payload = buildLicensePayload({
            name: "M365 Finance",
            vendor: "Microsoft",
            productName: "Microsoft 365 E3",
            licenseType: "SUBSCRIPTION",
            status: "ACTIVE",
            totalSeats: "50",
            usedSeats: "12",
            purchaseCost: "",
            annualRenewalCost: "12000",
            currency: "USD",
            expiryDate: "2027-03-31",
            autoRenew: false,
            licenseDocumentUrl: "https://docs/eula.pdf",
            notes: "Finance team",
        });
        expect(payload).toMatchObject({
            name: "M365 Finance",
            vendor: "Microsoft",
            productName: "Microsoft 365 E3",
            licenseType: "SUBSCRIPTION",
            totalSeats: 50,
            usedSeats: 12,
            purchaseCost: null,
            annualRenewalCost: 12000,
            expiryDate: "2027-03-31",
            licenseDocumentUrl: "https://docs/eula.pdf",
            notes: "Finance team",
        });
        for (const legacy of ["seats", "allocatedSeats", "monthlyCost", "supplierId"]) {
            expect(payload).not.toHaveProperty(legacy);
        }
    });

    it("only offers license types the backend enum has", () => {
        expect(LICENSE_TYPES).toEqual(["PERPETUAL", "SUBSCRIPTION", "VOLUME", "OPEN_SOURCE", "TRIAL", "ENTERPRISE", "OEM"]);
        expect(LICENSE_TYPES).not.toContain("NODE_LOCKED" as never);
    });
});

describe("contract payload", () => {
    it("sends key terms as notes and keeps the required dates", () => {
        const payload = buildContractPayload({
            title: "Printer SLA",
            contractType: "SERVICE_LEVEL_AGREEMENT",
            startDate: "2026-02-01",
            endDate: "2027-01-31",
            value: "1200",
            notes: "4h response",
            autoRenew: true,
        });
        expect(payload).toMatchObject({ notes: "4h response", startDate: "2026-02-01", endDate: "2027-01-31", value: 1200 });
        expect(payload).not.toHaveProperty("terms");
    });
});

describe("expense currency", () => {
    const budget = { name: "Travel", currency: "GHS" };

    it("uses the budget's currency", () => {
        expect(expenseCurrencyFor(budget, undefined)).toEqual({ currency: "GHS" });
        expect(expenseCurrencyFor(budget, "GHS")).toEqual({ currency: "GHS" });
    });

    it("explains a mismatch", () => {
        const result = expenseCurrencyFor(budget, "USD");
        expect(result.error).toContain("Travel");
        expect(result.error).toContain("GHS");
    });

    it("keeps the chosen currency without a budget", () => {
        expect(expenseCurrencyFor(undefined, "USD")).toEqual({ currency: "USD" });
    });
});
