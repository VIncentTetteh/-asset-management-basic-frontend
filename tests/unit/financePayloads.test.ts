import { describe, expect, it } from "vitest";
import {
    budgetAvailable,
    budgetCurrencyLocked,
    buildVendorReviewPayload,
    vendorReviewRating,
    buildBudgetPayload,
    buildContractPayload,
    buildLeasePayload,
    buildLicensePayload,
    buildPurchaseOrderPayload,
    buildSupplierPayload,
    SUPPLIER_STATUSES,
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
            remarks: null,
            expectedDeliveryDate: null,
            departmentId: "d1",
            supplierId: "s1",
            linkedBudgetId: "b1",
        });
        expect(payload).not.toHaveProperty("status");
    });

    it("carries the expected delivery date and clears blanks with null", () => {
        const payload = buildPurchaseOrderPayload({ poNumber: "PO-1", expectedDeliveryDate: "2026-10-01", remarks: " " });
        expect(payload.expectedDeliveryDate).toBe("2026-10-01");
        expect(payload.remarks).toBeNull();
        expect(buildPurchaseOrderPayload({ poNumber: "PO-1", expectedDeliveryDate: "" }).expectedDeliveryDate).toBeNull();
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

    it("sends blanks as null so a PUT unlinks the supplier and clears terms; blank value is unknown, not 0", () => {
        const payload = buildContractPayload({
            title: "SLA", contractType: "OTHER", startDate: "2026-01-01", endDate: "2026-12-31",
            supplierId: "", assetId: "", value: "", notes: " ", contractNumber: "", documentUrl: "", alertDaysBefore: "",
        });
        expect(payload).toMatchObject({
            supplierId: null, assetId: null, value: null, notes: null, contractNumber: null,
            documentUrl: null, alertDaysBefore: null,
        });
    });

    it("wires contract number, alert days, document URL and linked asset", () => {
        expect(buildContractPayload({
            title: "SLA", contractType: "OTHER", startDate: "2026-01-01", endDate: "2026-12-31",
            contractNumber: " C-9 ", alertDaysBefore: "45", documentUrl: "https://x/y.pdf", assetId: "a1",
        })).toMatchObject({ contractNumber: "C-9", alertDaysBefore: 45, documentUrl: "https://x/y.pdf", assetId: "a1" });
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

describe("buildVendorReviewPayload", () => {
    it("always derives the overall rating from the sub-scores", () => {
        const p = buildVendorReviewPayload({
            supplierId: "s1", rating: 5, qualityScore: "4", deliveryScore: "3", supportScore: "3",
            periodStart: "2026-01-01", periodEnd: "2026-03-31", feedback: "  ok ",
        });
        expect(p.rating).toBe(3.33);
        expect(p).toMatchObject({ qualityScore: 4, deliveryScore: 3, supportScore: 3, feedback: "ok" });
    });

    it("sends whole-number sub-scores (the API takes Integer 1-5)", () => {
        const p = buildVendorReviewPayload({ supplierId: "s1", qualityScore: "5", deliveryScore: "5", supportScore: "4" });
        expect(Number.isInteger(p.qualityScore)).toBe(true);
        expect(p.rating).toBe(4.67);
    });

    it("blank optional fields become null", () => {
        const p = buildVendorReviewPayload({ supplierId: "s1", qualityScore: "2", deliveryScore: "", supportScore: "", feedback: " " });
        expect(p.deliveryScore).toBeNull();
        expect(p.feedback).toBeNull();
        expect(p.rating).toBe(2);
    });
});

describe("vendorReviewRating", () => {
    it("is null when no score is given", () => {
        expect(vendorReviewRating([null, null, null])).toBeNull();
    });
});

describe("budgetCurrencyLocked", () => {
    it("locks the currency once anything is spent or committed", () => {
        expect(budgetCurrencyLocked({ spentAmount: 0, committedAmount: 0 })).toBe(false);
        expect(budgetCurrencyLocked({ spentAmount: 10, committedAmount: 0 })).toBe(true);
        expect(budgetCurrencyLocked({ spentAmount: 0, committedAmount: 5 })).toBe(true);
        expect(budgetCurrencyLocked(null)).toBe(false);
    });
});

describe("supplier payload", () => {
    it("sends every optional field, blanks as null, so a PUT clears them", () => {
        expect(buildSupplierPayload({
            name: " Acme ", email: "", phone: " ", contactPerson: "Ama", taxId: "",
            registrationNumber: "", address: "", status: "SUSPENDED",
        })).toEqual({
            name: "Acme", email: null, phone: null, contactPerson: "Ama", taxId: null,
            registrationNumber: null, address: null, status: "SUSPENDED",
        });
    });

    it("offers every SupplierStatus, including SUSPENDED", () => {
        expect(SUPPLIER_STATUSES.map((s) => s.value)).toEqual(["ACTIVE", "INACTIVE", "SUSPENDED", "BLACKLISTED"]);
    });
});
