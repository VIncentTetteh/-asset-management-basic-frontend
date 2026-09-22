import type { Budget, BudgetDto, ContractDto, PurchaseOrderDto, SoftwareLicenseDto, SupplierDto, SupplierStatus, VendorReviewDto } from "@/types";
import type { LeaseRecordDto } from "@/services/leaseRecordService";

/**
 * Form → API body builders for the finance screens.
 *
 * Kept out of the pages so the exact payloads are unit-tested: every one of the
 * defects these replace was a payload that did not match its backend DTO
 * (stripped required dates, `terms` instead of `notes`, `seats` instead of
 * `totalSeats`, a free-text lessor instead of a supplier id, a client-set status).
 */

/** Form values arrive as strings from inputs; "" means "not given". */
type Raw<T> = { [K in keyof T]?: T[K] | string | null };

const blank = (v: unknown): boolean => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** Number or null for an optional numeric input. */
export const optionalNumber = (v: unknown): number | null => {
    if (blank(v)) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/** Trimmed string or null for an optional text/select input. */
export const optionalString = (v: unknown): string | null => (blank(v) ? null : String(v).trim());

// ── Suppliers ─────────────────────────────────────────────────────────────────

/** Every SupplierStatus the API accepts, in display order. */
export const SUPPLIER_STATUSES: readonly { value: SupplierStatus; label: string }[] = [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
    { value: "SUSPENDED", label: "Suspended" },
    { value: "BLACKLISTED", label: "Blacklisted" },
];

export type SupplierForm = Raw<SupplierDto>;

/**
 * Full body for POST and PUT /suppliers. Every optional field is sent, a blank
 * one as null, so an edit (a full-replace PUT) clears what the user emptied.
 */
export function buildSupplierPayload(form: SupplierForm): SupplierDto {
    return {
        name: String(form.name ?? "").trim(),
        email: optionalString(form.email),
        phone: optionalString(form.phone),
        contactPerson: optionalString(form.contactPerson),
        taxId: optionalString(form.taxId),
        registrationNumber: optionalString(form.registrationNumber),
        address: optionalString(form.address),
        status: optionalString(form.status) ?? "ACTIVE",
    };
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export type BudgetForm = Raw<BudgetDto>;

/**
 * Full body for POST and PUT /budgets. Period dates are required by the API and
 * are always sent (never stripped). spent/committed are never sent: the ledger
 * owns them.
 */
export function buildBudgetPayload(form: BudgetForm): BudgetDto {
    return {
        name: String(form.name ?? "").trim(),
        // PUT replaces every field, so the description is carried even though the
        // form does not edit it.
        description: optionalString(form.description),
        status: (optionalString(form.status) ?? undefined) as BudgetDto["status"],
        totalAmount: Number(form.totalAmount),
        currency: optionalString(form.currency),
        fiscalYear: optionalNumber(form.fiscalYear),
        departmentId: optionalString(form.departmentId),
        periodStart: String(form.periodStart ?? ""),
        periodEnd: String(form.periodEnd ?? ""),
        alertThresholdPct: optionalNumber(form.alertThresholdPct),
    };
}

/**
 * The API refuses a currency change (409) once a budget holds spend or
 * commitments, because those amounts are recorded in its current currency.
 */
export function budgetCurrencyLocked(budget: Pick<Budget, "spentAmount" | "committedAmount"> | null | undefined): boolean {
    if (!budget) return false;
    return (budget.spentAmount || 0) !== 0 || (budget.committedAmount || 0) !== 0;
}

/** Headroom after spend and open commitments; the API's availableAmount when present. */
export function budgetAvailable(budget: Pick<Budget, "totalAmount" | "spentAmount" | "committedAmount" | "availableAmount">): number {
    if (typeof budget.availableAmount === "number") return budget.availableAmount;
    return (budget.totalAmount || 0) - (budget.spentAmount || 0) - (budget.committedAmount || 0);
}

// ── Purchase orders ───────────────────────────────────────────────────────────

export type PurchaseOrderForm = Raw<PurchaseOrderDto>;

/**
 * Full body for POST and PUT /purchase-orders. No status: the workflow endpoints
 * own it. An empty budget, remarks or expected delivery date is sent as null,
 * which clears it on PUT.
 */
export function buildPurchaseOrderPayload(form: PurchaseOrderForm): PurchaseOrderDto {
    return {
        poNumber: String(form.poNumber ?? "").trim(),
        totalAmount: Number(form.totalAmount),
        currency: optionalString(form.currency) ?? undefined,
        remarks: optionalString(form.remarks),
        expectedDeliveryDate: optionalString(form.expectedDeliveryDate),
        departmentId: String(form.departmentId ?? ""),
        supplierId: String(form.supplierId ?? ""),
        linkedBudgetId: optionalString(form.linkedBudgetId),
    };
}

// ── Leases ────────────────────────────────────────────────────────────────────

export type LeaseForm = Raw<LeaseRecordDto>;

/** Body for POST/PUT /leases. The lessor is a supplier id; its name is display-only. */
export function buildLeasePayload(form: LeaseForm): Partial<LeaseRecordDto> {
    return {
        assetId: optionalString(form.assetId) ?? undefined,
        lessorId: optionalString(form.lessorId) ?? undefined,
        startDate: optionalString(form.startDate) ?? undefined,
        endDate: optionalString(form.endDate) ?? undefined,
        monthlyPayment: optionalNumber(form.monthlyPayment) ?? undefined,
        currency: optionalString(form.currency) ?? undefined,
        autoRenew: form.autoRenew === true || form.autoRenew === "true",
        noticePeriodDays: optionalNumber(form.noticePeriodDays) ?? undefined,
        notes: optionalString(form.notes) ?? undefined,
    };
}

// ── Software licenses ─────────────────────────────────────────────────────────

export type LicenseForm = Raw<SoftwareLicenseDto>;

/** Full body for POST and PUT /licenses, in SoftwareLicenseDto field names. */
export function buildLicensePayload(form: LicenseForm): SoftwareLicenseDto {
    return {
        name: String(form.name ?? "").trim(),
        vendor: String(form.vendor ?? "").trim(),
        productName: optionalString(form.productName),
        version: optionalString(form.version),
        licenseType: form.licenseType as SoftwareLicenseDto["licenseType"],
        status: (optionalString(form.status) ?? undefined) as SoftwareLicenseDto["status"],
        totalSeats: optionalNumber(form.totalSeats),
        usedSeats: optionalNumber(form.usedSeats),
        purchaseCost: optionalNumber(form.purchaseCost),
        annualRenewalCost: optionalNumber(form.annualRenewalCost),
        currency: optionalString(form.currency),
        purchaseDate: optionalString(form.purchaseDate),
        expiryDate: optionalString(form.expiryDate),
        renewalDate: optionalString(form.renewalDate),
        autoRenew: form.autoRenew === true || form.autoRenew === "true",
        licenseDocumentUrl: optionalString(form.licenseDocumentUrl),
        notes: optionalString(form.notes),
    };
}

// ── Contracts ─────────────────────────────────────────────────────────────────

export type ContractForm = Raw<ContractDto>;

/**
 * Full body for POST and PUT /contracts. Key terms travel as `notes`; dates are
 * required. Every optional field is sent, blank as null, so an edit unlinks the
 * supplier or asset and clears the number, value, URL or terms the user emptied.
 * A blank value is "unknown" (null), never 0.
 */
export function buildContractPayload(form: ContractForm): ContractDto {
    return {
        title: String(form.title ?? "").trim(),
        contractNumber: optionalString(form.contractNumber),
        contractType: form.contractType as ContractDto["contractType"],
        status: (optionalString(form.status) ?? undefined) as ContractDto["status"],
        supplierId: optionalString(form.supplierId),
        assetId: optionalString(form.assetId),
        startDate: String(form.startDate ?? ""),
        endDate: String(form.endDate ?? ""),
        alertDaysBefore: optionalNumber(form.alertDaysBefore),
        value: optionalNumber(form.value),
        currency: optionalString(form.currency),
        autoRenew: form.autoRenew === true || form.autoRenew === "true",
        documentUrl: optionalString(form.documentUrl),
        notes: optionalString(form.notes),
    };
}

// ── Expenses ──────────────────────────────────────────────────────────────────

/**
 * An expense linked to a budget must be in the budget's currency (the API
 * refuses a mismatch). Returns the currency to use, or an error message when the
 * chosen currency conflicts with the budget.
 */
export function expenseCurrencyFor(
    budget: Pick<Budget, "name" | "currency"> | undefined,
    chosen: string | undefined,
): { currency?: string; error?: string } {
    if (!budget?.currency) return { currency: chosen };
    if (chosen && chosen.toUpperCase() !== budget.currency.toUpperCase()) {
        return {
            currency: budget.currency,
            error: `Budget "${budget.name}" is in ${budget.currency}; expenses linked to it must be in ${budget.currency}.`,
        };
    }
    return { currency: budget.currency };
}

// ── Vendor reviews ────────────────────────────────────────────────────────────

export type VendorReviewForm = Raw<VendorReviewDto>;

/** A 1–5 whole-number sub-score (`Integer @Min(1) @Max(5)` on the API), or null. */
const subScore = (v: unknown): number | null => {
    const n = optionalNumber(v);
    return n === null ? null : Math.round(n);
};

/**
 * The overall rating is always the average of the sub-scores given, to two
 * decimals (`@Digits(fraction = 2)`). It used to keep the previously saved
 * rating on edit, so changing the sub-scores never moved it.
 */
export function vendorReviewRating(scores: readonly (number | null)[]): number | null {
    const given = scores.filter((s): s is number => s !== null);
    if (given.length === 0) return null;
    return Math.round((given.reduce((a, b) => a + b, 0) / given.length) * 100) / 100;
}

export function buildVendorReviewPayload(form: VendorReviewForm): VendorReviewDto {
    const qualityScore = subScore(form.qualityScore);
    const deliveryScore = subScore(form.deliveryScore);
    const supportScore = subScore(form.supportScore);
    return {
        supplierId: optionalString(form.supplierId) ?? "",
        rating: vendorReviewRating([qualityScore, deliveryScore, supportScore]) ?? 0,
        qualityScore,
        deliveryScore,
        supportScore,
        feedback: optionalString(form.feedback),
        periodStart: optionalString(form.periodStart),
        periodEnd: optionalString(form.periodEnd),
    };
}
