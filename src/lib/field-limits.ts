import type { FieldPath, FieldValues, RegisterOptions } from "react-hook-form";

/**
 * Per-field limits, mirroring the backend request DTOs exactly.
 *
 * The backend (and its database columns) are the source of truth: every
 * `@Size(max)`, `@Digits`, `@Min`/`@Max`/`@DecimalMin`/`@PositiveOrZero` and
 * required (`@NotBlank`/`@NotNull`, on create) constraint in
 * `Enterprise-Asset-Manager/src/main/java/com/assetiq/dto` appears here, and
 * `DtoColumnConstraintConsistencyTest` there keeps those at least as strict as
 * the columns. When a DTO constraint changes, change it here too.
 *
 * `required` means "required on create / full replace"; a PATCH may omit the
 * field but not blank it.
 */
export interface FieldLimit {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    /** HTML step for number inputs: the backend's fraction digits (0.01 for money). */
    step?: number | "any";
}

export type EntityLimits = Readonly<Record<string, FieldLimit>>;

/** NUMERIC(15,2): @Digits(integer = 13, fraction = 2), not negative. */
const MONEY: FieldLimit = { min: 0, max: 9_999_999_999_999.99, step: 0.01 };
/** NUMERIC(15,2) that must be positive: @DecimalMin("0.01"). */
const POSITIVE_MONEY: FieldLimit = { required: true, min: 0.01, max: 9_999_999_999_999.99, step: 0.01 };
const COUNT: FieldLimit = { min: 0, step: 1 };
const CURRENCY: FieldLimit = { maxLength: 3 };
const text = (maxLength: number, required = false): FieldLimit => (required ? { required, maxLength } : { maxLength });
const REQUIRED: FieldLimit = { required: true };

export const FIELD_LIMITS = {
    asset: {
        name: text(255, true),
        assetTag: text(255),
        serialNumber: text(255),
        barcodeQrCode: text(255),
        manufacturer: text(255),
        model: text(255),
        invoiceId: text(255),
        insurancePolicyId: text(255),
        costCenter: text(100),
        currency: CURRENCY,
        purchaseCost: MONEY,
        residualValue: MONEY,
        usefulLifeMonths: { min: 1, step: 1 },
    },
    assetAudit: { auditDate: REQUIRED, remarks: text(5000) },
    assetCustomField: { fieldName: text(100, true) },
    assetTransfer: { assetId: REQUIRED, toDepartmentId: REQUIRED, reason: text(2000) },
    budget: {
        name: text(255, true),
        totalAmount: POSITIVE_MONEY,
        currency: CURRENCY,
        periodStart: REQUIRED,
        periodEnd: REQUIRED,
        alertThresholdPct: { min: 1, max: 100, step: 1 },
    },
    budgetAdjustment: { amount: POSITIVE_MONEY, note: REQUIRED },
    category: {
        name: text(255, true),
        assetPrefixCode: text(255),
        defaultWarrantyPeriodMonths: COUNT,
    },
    checkout: { notes: text(2000), conditionOnCheckout: text(50), conditionOnReturn: text(50) },
    cloudAsset: {
        name: text(200, true),
        provider: REQUIRED,
        region: text(100, true),
        resourceId: text(500, true),
        resourceType: REQUIRED,
        accountId: text(200),
        currency: text(10),
        environment: text(50),
        monthlyCostEstimate: { min: 0, max: 99_999_999_999.9999, step: 0.0001 },
    },
    contract: {
        title: text(255, true),
        contractNumber: text(100),
        contractType: REQUIRED,
        startDate: REQUIRED,
        endDate: REQUIRED,
        value: MONEY,
        currency: CURRENCY,
        documentUrl: text(500),
        alertDaysBefore: COUNT,
    },
    department: {
        name: text(255, true),
        departmentCode: text(255),
        costCenterCode: text(255),
        budgetLimit: { min: 0, step: 0.01 },
    },
    depreciationPolicy: {
        name: text(255, true),
        method: REQUIRED,
        usefulLifeMonths: { min: 1, step: 1 },
        salvageValuePercent: { min: 0, max: 100, step: 0.01 },
    },
    disposal: {
        assetId: REQUIRED,
        disposalMethod: REQUIRED,
        disposalDate: REQUIRED,
        saleValue: MONEY,
        currency: CURRENCY,
        reason: text(5000),
        complianceDocumentUrl: text(255),
    },
    employee: {
        firstName: text(255, true),
        lastName: text(255, true),
        employeeNumber: text(100),
        email: text(255),
        phone: text(100),
        jobTitle: text(255),
    },
    exchangeRate: {
        baseCurrency: { required: true, maxLength: 3 },
        targetCurrency: { required: true, maxLength: 3 },
        rate: { required: true, min: 0.00000001, max: 9_999_999_999.99999999, step: "any" },
        source: text(50),
    },
    expense: {
        title: text(255, true),
        amount: POSITIVE_MONEY,
        category: REQUIRED,
        currency: CURRENCY,
        receiptUrl: text(500),
    },
    lease: {
        assetId: REQUIRED,
        lessorId: REQUIRED,
        startDate: REQUIRED,
        endDate: REQUIRED,
        monthlyPayment: POSITIVE_MONEY,
        currency: CURRENCY,
        noticePeriodDays: COUNT,
    },
    location: {
        name: text(255, true),
        building: text(255),
        floor: text(255),
        room: text(255),
        city: text(255),
        country: text(255),
    },
    maintenance: { assetId: REQUIRED, maintenanceType: REQUIRED, cost: MONEY, currency: CURRENCY },
    organisation: {
        name: text(255, true),
        registrationNumber: text(255),
        taxId: text(255),
        industry: text(255),
        country: text(255),
        contactEmail: text(255),
        contactPhone: text(255),
        timezone: text(255),
        billingCurrency: CURRENCY,
    },
    purchaseOrder: {
        poNumber: text(255, true),
        totalAmount: POSITIVE_MONEY,
        currency: CURRENCY,
        departmentId: REQUIRED,
        supplierId: REQUIRED,
    },
    role: { name: text(255, true) },
    softwareLicense: {
        name: text(255, true),
        vendor: text(255, true),
        productName: text(255),
        version: text(255),
        licenseType: REQUIRED,
        totalSeats: COUNT,
        usedSeats: COUNT,
        purchaseCost: MONEY,
        annualRenewalCost: MONEY,
        currency: CURRENCY,
        licenseDocumentUrl: text(255),
    },
    ssoConfig: {
        provider: REQUIRED,
        clientId: text(255),
        issuerUri: text(255),
        scopes: text(255),
        spEntityId: text(255),
        emailDomain: text(255),
    },
    storageConfig: {
        bucketName: text(255),
        reportPrefix: text(200),
        importPrefix: text(200),
        presignMinutes: { min: 1, max: 10080, step: 1 },
    },
    supplier: {
        name: text(255, true),
        registrationNumber: text(255),
        contactPerson: text(255),
        email: text(255),
        phone: text(255),
        taxId: text(255),
    },
    user: {
        firstName: text(255, true),
        lastName: text(255, true),
        email: text(255, true),
        phone: text(255),
        employeeId: text(255),
        jobTitle: text(255),
        password: { minLength: 8, maxLength: 128 },
    },
    vendorReview: {
        rating: { required: true, min: 1, max: 5, step: 0.01 },
        qualityScore: { min: 1, max: 5, step: 1 },
        deliveryScore: { min: 1, max: 5, step: 1 },
        supportScore: { min: 1, max: 5, step: 1 },
    },
    webhook: { name: text(200, true), url: text(2048, true), secret: text(512) },
    dsar: { requestType: REQUIRED, requesterEmail: text(255, true) },
    consent: { purpose: text(100, true) },

    // ── Compliance ───────────────────────────────────────────────────────────
    complianceControl: {
        framework: REQUIRED,
        controlRef: text(64, true),
        controlName: text(255, true),
        evidenceUrl: text(255),
        lastReviewedByEmail: text(255),
    },
    bogControl: { directiveRef: text(32, true), requirement: REQUIRED, evidenceUrl: text(255) },
    icsAsset: { assetId: REQUIRED, firmwareVersion: text(64), protocol: text(128) },
    patchRecord: { assetId: REQUIRED, patchName: text(255, true), version: text(64), appliedByEmail: text(255) },
    pciSaq: { requirementNumber: text(16, true), evidenceUrl: text(255) },
    regulatoryFiling: {
        filingType: text(255, true),
        regulator: text(32, true),
        dueDate: REQUIRED,
        reference: text(128),
    },
    riskRegister: {
        title: text(255, true),
        riskId: text(32),
        likelihood: { required: true, min: 1, max: 5, step: 1 },
        impact: { required: true, min: 1, max: 5, step: 1 },
        residualRisk: { min: 1, max: 25, step: 1 },
    },
    securityIncident: { title: text(255, true), severity: REQUIRED, category: text(64) },
    securityPolicy: { title: text(255, true), version: text(16), documentUrl: text(255), approvedByEmail: text(255) },
    securityZone: {
        name: text(255, true),
        purdueLevel: { required: true, min: 0, max: 5, step: 1 },
        allowedProtocols: text(255),
        networkRange: text(255),
        assetCount: COUNT,
    },
    slaMetric: {
        month: { required: true, min: 1, max: 12, step: 1 },
        year: { required: true, min: 2000, max: 2100, step: 1 },
        uptimePercent: { required: true, min: 0, max: 100, step: 0.001 },
        plannedDowntimeMinutes: COUNT,
        unplannedDowntimeMinutes: COUNT,
        incidentCount: COUNT,
        rtoMinutes: COUNT,
        rpoMinutes: COUNT,
    },
    vulnerabilityScan: {
        scanDate: REQUIRED,
        scanType: REQUIRED,
        scannerTool: text(128),
        reportUrl: text(255),
        criticalCount: COUNT,
        highCount: COUNT,
        mediumCount: COUNT,
        lowCount: COUNT,
    },
} as const satisfies Record<string, EntityLimits>;

export type LimitedEntity = keyof typeof FIELD_LIMITS;

/** The limit for one field, or `{}` when the backend sets none. */
export function fieldLimit(entity: LimitedEntity, field: string): FieldLimit {
    const limits: EntityLimits = FIELD_LIMITS[entity];
    return limits[field] ?? {};
}

/** HTML attributes for an input: maxLength, min, max and step. */
export function limitInputProps(limit: FieldLimit): {
    maxLength?: number;
    min?: number;
    max?: number;
    step?: number | "any";
} {
    const props: { maxLength?: number; min?: number; max?: number; step?: number | "any" } = {};
    if (limit.maxLength !== undefined) props.maxLength = limit.maxLength;
    if (limit.min !== undefined) props.min = limit.min;
    if (limit.max !== undefined) props.max = limit.max;
    if (limit.step !== undefined) props.step = limit.step;
    return props;
}

/**
 * react-hook-form rules with a message for every limit, so an out-of-range value
 * shows an inline field error instead of failing silently or reaching the server.
 */
export function limitRules<T extends FieldValues, N extends FieldPath<T> = FieldPath<T>>(
    limit: FieldLimit,
    label: string,
): RegisterOptions<T, N> {
    const rules: RegisterOptions<T, N> = {};
    if (limit.required) {
        rules.required = `${label} is required`;
    }
    if (limit.maxLength !== undefined) {
        rules.maxLength = { value: limit.maxLength, message: `${label} must be at most ${limit.maxLength} characters` };
    }
    if (limit.minLength !== undefined) {
        rules.minLength = { value: limit.minLength, message: `${label} must be at least ${limit.minLength} characters` };
    }
    if (limit.min !== undefined) {
        rules.min = { value: limit.min, message: `${label} must be at least ${limit.min}` };
    }
    if (limit.max !== undefined) {
        rules.max = { value: limit.max, message: `${label} must be at most ${limit.max}` };
    }
    if (limit.required && limit.maxLength !== undefined) {
        // Mirrors @NotBlank: whitespace alone is not a value.
        rules.validate = (value: unknown) =>
            typeof value !== "string" || value.trim().length > 0 || `${label} is required`;
    }
    return rules;
}
