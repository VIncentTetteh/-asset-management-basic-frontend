// ─── Base ─────────────────────────────────────────────────────────────────────
export interface BaseEntity {
    id: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    modifiedBy?: string;
}

// ─── Organisation ─────────────────────────────────────────────────────────────
export type OrganisationStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DELETED";

export interface Organisation extends BaseEntity {
    name: string;
    registrationNumber?: string;
    taxId?: string;
    industry?: string;
    country?: string;
    address?: string;
    contactEmail?: string;
    contactPhone?: string;
    timezone?: string;
    status?: OrganisationStatus | string;
}

export interface OrganisationDto {
    id?: string;
    name: string;
    registrationNumber?: string;
    taxId?: string;
    industry?: string;
    country?: string;
    address?: string;
    contactEmail?: string;
    contactPhone?: string;
    timezone?: string;
    status?: OrganisationStatus | string;
}

// ─── SSO Config ───────────────────────────────────────────────────────────────
// ─── Department ───────────────────────────────────────────────────────────────
export type DepartmentStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface Department extends BaseEntity {
    name: string;
    description?: string;
    departmentCode?: string;
    parentDepartmentId?: string | null;
    managerId?: string | null;
    costCenterCode?: string;
    budgetLimit?: number;
    status?: DepartmentStatus | string;
    organisationId?: string;
}

export interface DepartmentDto {
    id?: string;
    name: string;                        // required
    description?: string;
    departmentCode?: string;
    parentDepartmentId?: string | null;  // optional — for sub-depts
    managerId?: string | null;
    costCenterCode?: string;
    budgetLimit?: number;
    status?: DepartmentStatus | string;
}

// ─── Location ─────────────────────────────────────────────────────────────────
export interface Location extends BaseEntity {
    name: string;
    building?: string;
    floor?: string;
    room?: string;
    city?: string;
    country?: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
    geoCoordinates?: string;
    parentLocationId?: string | null;
    organisationId?: string;
}

export interface LocationDto {
    id?: string;
    name: string;                        // required
    building?: string;
    floor?: string;
    room?: string;
    city?: string;
    country?: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
    geoCoordinates?: string;
    parentLocationId?: string | null;    // optional — nested locations
}

// ─── Asset Enums ──────────────────────────────────────────────────────────────
export enum AssetStatus {
    PENDING_PROCUREMENT = "PENDING_PROCUREMENT",
    IN_STOCK = "IN_STOCK",
    RESERVED = "RESERVED",
    IN_USE = "IN_USE",
    MAINTENANCE = "MAINTENANCE",
    UNDER_REPAIR = "UNDER_REPAIR",
    RETIRED = "RETIRED",
    DISPOSED = "DISPOSED",
    MISSING = "MISSING",
}

export enum AssetCondition {
    EXCELLENT = "EXCELLENT",
    NEW = "NEW",
    GOOD = "GOOD",
    FAIR = "FAIR",
    POOR = "POOR",
    DAMAGED = "DAMAGED",
    SCRAP = "SCRAP",
}

export enum AssetType {
    FURNITURE = "FURNITURE",
    SOFTWARE = "SOFTWARE",
    HARDWARE = "HARDWARE",
    VEHICLE = "VEHICLE",
    EQUIPMENT = "EQUIPMENT",
    OTHER = "OTHER",
}

export enum AssetState {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    ARCHIVED = "ARCHIVED",
}

export enum DepreciationMethod {
    STRAIGHT_LINE = "STRAIGHT_LINE",
    DECLINING_BALANCE = "DECLINING_BALANCE",
    SUM_OF_YEARS_DIGITS = "SUM_OF_YEARS_DIGITS",
    UNITS_OF_PRODUCTION = "UNITS_OF_PRODUCTION",
}

/** CAPEX (owned, depreciated) or OPEX (leased, rented, subscribed); mirrors the API enum. */
export enum ProcurementType {
    CAPEX = "CAPEX",
    OPEX = "OPEX",
}

// ─── Asset ────────────────────────────────────────────────────────────────────
export interface Asset extends BaseEntity {
    name: string;
    assetTag?: string;
    serialNumber?: string;
    barcode?: string;
    barcodeQrCode?: string;
    description?: string;
    categoryId?: string;
    assetType?: AssetType | string;
    manufacturer?: string;
    model?: string;
    purchaseDate?: string;
    purchaseCost?: number;
    currency?: string;
    depreciationMethod?: DepreciationMethod | string;
    usefulLifeMonths?: number;
    salvageValue?: number;
    residualValue?: number;
    warrantyExpiryDate?: string;
    status?: AssetStatus | string;
    condition?: AssetCondition | string;
    locationId?: string;
    assignedUserId?: string;
    supplierId?: string;
    invoiceId?: string;
    insurancePolicyId?: string;
    departmentId?: string;
    purchaseOrderId?: string;
    procurementType?: ProcurementType | string | null;
    costCenter?: string | null;
    /** TCO inputs, in the asset's currency. */
    insurancePremiumPerYear?: number | null;
    downtimeCostPerDay?: number | null;
    insurancePolicyExpiry?: string | null;
    /** The asset this one is a component of. */
    parentAssetId?: string | null;
    organisationId?: string;
    /** Net book value as of today, computed server-side by the depreciation engine. */
    currentBookValue?: number;
    // Read-only depreciation figures (asset currency), computed as of today.
    accumulatedDepreciation?: number;
    /** Charge for the month of service in progress; 0 when fully depreciated or disposed. */
    monthlyDepreciation?: number;
    /** False when no useful life (asset or category policy) or purchase date is set. */
    depreciationConfigured?: boolean;
    fullyDepreciated?: boolean;
    /** Method/life/residual actually applied (asset field, else the category policy). */
    effectiveDepreciationMethod?: DepreciationMethod | string;
    effectiveUsefulLifeMonths?: number | null;
    effectiveResidualValue?: number | null;
}

/**
 * Optional fields an asset update can clear (a missing/null field means "unchanged").
 * Mirrors `AssetServiceImpl.CLEARABLE_FIELDS`; clearing a depreciation override
 * falls back to the category's depreciation policy.
 */
export const CLEARABLE_ASSET_FIELDS = [
    "departmentId", "locationId", "supplierId", "purchaseOrderId", "assignedUserId",
    "parentAssetId", "categoryId", "insurancePremiumPerYear", "downtimeCostPerDay", "insurancePolicyExpiry",
    "depreciationMethod", "usefulLifeMonths", "residualValue", "purchaseCost", "purchaseDate",
    "warrantyExpiryDate", "assetTag", "serialNumber", "manufacturer", "model", "description",
    "invoiceId", "insurancePolicyId", "costCenter", "procurementType",
] as const;
export type ClearableAssetField = (typeof CLEARABLE_ASSET_FIELDS)[number];

export interface AssetDto {
    id?: string;
    name: string;                  // required
    assetTag?: string;
    serialNumber?: string;
    barcode?: string;
    barcodeQrCode?: string;
    description?: string;
    categoryId?: string;
    assetType?: AssetType | string;
    manufacturer?: string;
    model?: string;
    purchaseDate?: string;
    purchaseCost?: number;
    currency?: string;
    depreciationMethod?: DepreciationMethod | string;
    usefulLifeMonths?: number;
    salvageValue?: number;
    residualValue?: number;
    warrantyExpiryDate?: string;
    status?: AssetStatus | string;
    condition?: AssetCondition | string;
    locationId?: string;
    assignedUserId?: string;
    supplierId?: string;
    invoiceId?: string;
    insurancePolicyId?: string;
    departmentId?: string;
    purchaseOrderId?: string;
    procurementType?: ProcurementType | string | null;
    costCenter?: string | null;
    /** TCO inputs, in the asset's currency. */
    insurancePremiumPerYear?: number | null;
    downtimeCostPerDay?: number | null;
    insurancePolicyExpiry?: string | null;
    /** The asset this one is a component of. */
    parentAssetId?: string | null;
    currentBookValue?: number;
    /** Update only: optional fields to clear explicitly. */
    clearFields?: ClearableAssetField[];
}

// ─── Asset History ────────────────────────────────────────────────────────────
export interface AssetHistory extends BaseEntity {
    assetId: string;
    action?: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    notes?: string;
    userId?: string;
    /** Backend compatibility fields */
    eventType?: string | null;
    actor?: string | null;
    summary?: string | null;
    occurredAt?: string | null;
    userName?: string | null;
    path?: string | null;
    httpMethod?: string | null;
    description?: string | null;
}

// ─── Asset Custom Fields ──────────────────────────────────────────────────────
export interface AssetCustomField extends BaseEntity {
    assetId?: string;
    fieldId?: string;
    fieldName?: string;
    fieldValue?: string;
    name?: string;
    key?: string;
    label?: string;
    value?: string | number | boolean | null;
    dataType?: string;
    required?: boolean;
}

export interface AssetCustomFieldDto {
    id?: string;
    assetId?: string;
    fieldName?: string;
    fieldValue?: string;
    name?: string;
    key?: string;
    label?: string;
    value?: string | number | boolean | null;
    dataType?: string;
    required?: boolean;
}

// ─── Asset Import ─────────────────────────────────────────────────────────────
export interface AssetImportRowError {
    row: number;
    message: string;
}

export interface AssetImportResult {
    totalRows: number;
    imported: number;
    skipped: number;
    errors: AssetImportRowError[];
}

// ─── Category ─────────────────────────────────────────────────────────────────
export interface Category extends BaseEntity {
    name: string;
    description?: string;
    assetPrefixCode?: string;
    parentCategoryId?: string | null;
    depreciationPolicyId?: string;
    defaultWarrantyPeriodMonths?: number;
    organisationId?: string;
}

export interface CategoryDto {
    id?: string;
    name: string;                         // required
    description?: string;
    assetPrefixCode?: string;
    parentCategoryId?: string | null;
    depreciationPolicyId?: string;
    defaultWarrantyPeriodMonths?: number;
    /** Update only: optional fields to clear explicitly. */
    clearFields?: (
        "depreciationPolicyId" | "parentCategoryId" | "description" | "assetPrefixCode" | "defaultWarrantyPeriodMonths"
    )[];
}

// ─── Role ─────────────────────────────────────────────────────────────────────
export type Permission =
    | "VIEW_ASSETS" | "CREATE_ASSETS" | "UPDATE_ASSETS" | "DELETE_ASSETS"
    | "VIEW_USERS" | "CREATE_USERS" | "UPDATE_USERS" | "DELETE_USERS"
    | "VIEW_DEPARTMENTS" | "MANAGE_DEPARTMENTS"
    | "VIEW_REPORTS" | "MANAGE_PURCHASE_ORDERS"
    | "VIEW_AUDIT_REPORTS" | "MANAGE_MAINTENANCE"
    | "MANAGE_DEPRECIATION_POLICIES" | "MANAGE_DISPOSALS";

export interface Role {
    id: string;
    name: string;
    description?: string;
    /** Flat array of permission names returned by the API (Phase 2 / B-1). */
    permissions: string[];
    organisationId?: string;
    /** True if this is a built-in role that cannot be modified or deleted. */
    systemRole?: boolean;
    /** True if the bearer receives every permission in the system. */
    grantAllPermissions?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface RoleDto {
    name: string;                 // required
    description?: string;
    /** Plain array of permission names to assign, e.g. ["VIEW_ASSETS", "MANAGE_ROLES"]. */
    permissions: string[];
    grantAllPermissions?: boolean;
}

// ─── User ─────────────────────────────────────────────────────────────────────
export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "TERMINATED";

export interface User extends BaseEntity {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    employeeId?: string;
    jobTitle?: string;
    /** Display name of the user's primary role. */
    role?: string;
    /** Primary role UUID — used for JWT claims and single-role queries. */
    roleId?: string;
    /**
     * All role UUIDs assigned to this user (Phase 2 / B-5 role composition).
     * The effective permission set is the union of all assigned roles.
     */
    roleIds?: string[];
    status?: UserStatus | string;
    organisationId?: string;
    departmentId?: string;
    /** Whether TOTP-based MFA is currently active for this user */
    mfaEnabled?: boolean;
}

export interface UserDto {
    id?: string;
    firstName: string;            // required
    lastName: string;             // required
    email: string;                // required
    phone?: string;
    employeeId?: string;
    jobTitle?: string;
    roleId?: string;
    organisationId?: string;
    departmentId?: string;
    password?: string;            // required on creation only
    status?: UserStatus | string;
}

// ─── Purchase Order ───────────────────────────────────────────────────────────
export enum POStatus {
    DRAFT = "DRAFT",
    SUBMITTED = "SUBMITTED",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    DELIVERED = "DELIVERED",
    CANCELLED = "CANCELLED",
}

export interface PurchaseOrder extends BaseEntity {
    poNumber: string;
    totalAmount: number;
    currency?: string;
    /** Server-owned: changed only through submit/approve/reject/receive/cancel. */
    status?: POStatus | string;
    remarks?: string;
    organisationId?: string;
    departmentId?: string;
    supplierId?: string;
    /** Budget the order commits against on approval and spends on receipt. */
    linkedBudgetId?: string | null;
    requestedById?: string | null;
    approvedById?: string | null;
    rejectedById?: string | null;
    approvedAt?: string | null;
    rejectedAt?: string | null;
}

/** Create/replace body. Status is not client-editable; use the workflow endpoints. */
export interface PurchaseOrderDto {
    id?: string;
    poNumber: string;             // required, unique within org
    totalAmount: number;          // required
    currency?: string;
    remarks?: string;
    departmentId: string;         // required
    supplierId: string;           // required
    /** null unlinks the budget on PUT. */
    linkedBudgetId?: string | null;
    organisationId?: string;
}

// ─── Maintenance ──────────────────────────────────────────────────────────────
export enum MaintenanceType {
    PREVENTIVE = "PREVENTIVE",
    CORRECTIVE = "CORRECTIVE",
    EMERGENCY = "EMERGENCY",
    ROUTINE = "ROUTINE",
}

export enum MaintenanceStatus {
    SCHEDULED = "SCHEDULED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
}

export interface MaintenanceRecord extends BaseEntity {
    assetId: string;
    maintenanceType: MaintenanceType | string;
    description?: string;
    scheduledDate: string;
    performedDate?: string;
    vendorId?: string;
    cost?: number;
    currency?: string;
    status: MaintenanceStatus | string;
    nextDueDate?: string;
    organisationId?: string;
}

export interface MaintenanceDto {
    id?: string;
    assetId: string;              // required
    maintenanceType: MaintenanceType | string;  // required
    description?: string | null;
    scheduledDate?: string | null;
    /** null on PUT clears the vendor. */
    vendorId?: string | null;
    cost?: number | null;
    currency?: string | null;
    status?: MaintenanceStatus | string;
    nextDueDate?: string | null;
    performedDate?: string | null;
}

// ─── Audit ────────────────────────────────────────────────────────────────────
export enum AuditStatus {
    PLANNED = "PLANNED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    DISCREPANCY_FOUND = "DISCREPANCY_FOUND",
    RESOLVED = "RESOLVED",
}

export interface Audit extends BaseEntity {
    organisationId?: string;
    departmentId?: string;
    /** Read-only; null for an organisation-wide audit. */
    departmentName?: string | null;
    auditDate: string;
    conductedById?: string;
    /** Read-only display name of the auditor. */
    conductedByName?: string | null;
    status?: AuditStatus | string;
    remarks?: string;
}

export interface AssetAuditDto {
    id?: string;
    /** Read-only: the API scopes audits to the caller's organisation. */
    organisationId?: string;
    /** Omit for an organisation-wide audit. */
    departmentId?: string;
    auditDate: string;            // required
    /** Omit to record the current user as the auditor. */
    conductedById?: string;
    status?: AuditStatus | string;
    remarks?: string;
}

// ─── Asset Transfer ───────────────────────────────────────────────────────────
/** Statuses the transfer workflow produces (the API enum also lists IN_TRANSIT/CANCELLED, never written). */
export enum TransferStatus {
    REQUESTED = "REQUESTED",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    COMPLETED = "COMPLETED",
}

export interface AssetTransfer extends BaseEntity {
    assetId: string;
    fromDepartmentId?: string;
    toDepartmentId?: string;
    fromLocationId?: string;
    toLocationId?: string;
    requestedById?: string;
    approvedById?: string;
    /** Who completed the move (API V43+). */
    completedById?: string;
    /** Display names of the requester, approver and completer (read-only). */
    requestedByName?: string;
    approvedByName?: string;
    completedByName?: string;
    /** Read-only: the day the transfer was completed. */
    transferDate?: string;
    reason?: string;
    status?: TransferStatus | string;
}

export interface AssetTransferDto {
    id?: string;
    assetId: string;              // required
    /** Read-only: the API derives the origin from the asset (null when it has no department). */
    fromDepartmentId?: string | null;
    toDepartmentId: string;       // required
    /** Read-only: derived from the asset's location. */
    fromLocationId?: string | null;
    toLocationId?: string;
    requestedById?: string;       // server-assigned from the authenticated session
    reason?: string;
}

// ─── Disposal ─────────────────────────────────────────────────────────────────
export enum DisposalMethod {
    SALE = "SALE",
    DONATION = "DONATION",
    SCRAP = "SCRAP",
    RECYCLING = "RECYCLING",
    TRADE_IN = "TRADE_IN",
    RETURN = "RETURN",
}

/** Maker-checker lifecycle (API V44): requested, then approved by someone else. */
export type DisposalStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export interface DisposalRecord extends BaseEntity {
    assetId: string;
    /** The asset's name and tag (read-only), so the list needs no asset lookup. */
    assetName?: string;
    assetTag?: string | null;
    disposalMethod: DisposalMethod | string;
    disposalDate: string;
    saleValue?: number;
    /** Currency of saleValue when the backend reports one; otherwise the base currency. */
    currency?: string | null;
    status?: DisposalStatus;
    requestedById?: string;
    approvedById?: string;
    approvedAt?: string;
    rejectedById?: string;
    rejectedAt?: string;
    /** Why it was rejected or withdrawn. */
    rejectionReason?: string | null;
    /** Approval-trail display names (read-only). */
    requestedByName?: string | null;
    approvedByName?: string | null;
    rejectedByName?: string | null;
    reason?: string;
    complianceDocumentUrl?: string;
    organisationId?: string;
}

export interface DisposalsDto {
    id?: string;
    assetId: string;              // required
    disposalMethod: DisposalMethod | string;  // required
    disposalDate: string;         // required
    saleValue?: number | null;
    /** ISO code of saleValue; the API defaults it to the asset's currency. */
    currency?: string | null;
    reason?: string | null;
    complianceDocumentUrl?: string | null;
}

// ─── Supplier ─────────────────────────────────────────────────────────────────
export type SupplierStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLACKLISTED";

export interface Supplier extends BaseEntity {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    contactPerson?: string;
    taxId?: string;
    registrationNumber?: string;
    status?: SupplierStatus | string;
    organisationId?: string;
}

export interface SupplierDto {
    id?: string;
    name: string;                 // required
    email?: string;
    phone?: string;
    address?: string;
    contactPerson?: string;
    taxId?: string;
    registrationNumber?: string;
    status?: SupplierStatus | string;
    organisationId?: string;
}

// ─── Depreciation Policy ──────────────────────────────────────────────────────
export interface DepreciationPolicy extends BaseEntity {
    name: string;
    method?: DepreciationMethod | string;
    usefulLifeMonths?: number;
    salvageValuePercent?: number;
    description?: string;
    organisationId?: string;
}

export interface DepreciationPolicyDto {
    id?: string;
    name: string;                 // required
    method: DepreciationMethod | string;  // required
    usefulLifeMonths?: number | null;
    salvageValuePercent?: number | null;
    description?: string | null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** Returned when MFA is required — no token yet, just a short-lived challenge. */
export interface MfaChallengeResponse {
    mfaRequired: true;
    mfaChallengeToken: string;
}

/** Returned when login succeeds without (or after) MFA verification. */
export interface LoginSuccessResponse {
    token: string;
    expiresIn: number;
    tokenType: string;
    user: User;
}

/** Union of all possible /auth/login responses. */
export type LoginResponse = LoginSuccessResponse | MfaChallengeResponse;

/** Response body from POST /mfa/challenge */
export interface MfaChallengeVerifyResponse {
    token: string;
    expiresIn: number;
    user: User;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
    items: T[];
    content?: T[];
    total: number;
    limit: number;
    offset: number;
    totalElements?: number;
    totalPages: number;
    currentPage?: number;
    pageSize?: number;
    number?: number;
    size?: number;
    first?: boolean;
    last?: boolean;
}

// ─── Currency ─────────────────────────────────────────────────────────────────

/** GET/PUT /currency/settings — the organisation's reporting (base) currency. */
export interface CurrencySettings {
    /** ISO-4217 code every server-side money aggregate is reported in. */
    baseCurrency: string;
    /** baseCurrency plus every currency with an exchange rate to/from it. */
    availableCurrencies: string[];
    /** True for org admins, who may change baseCurrency. */
    canEdit: boolean;
}

/**
 * Fields the backend adds to every money aggregate (dashboard, analytics,
 * budget summary, cloud cost summary). Amounts are already converted into
 * `currency`; records whose currency had no exchange rate are EXCLUDED from
 * the totals and listed in `missingRates` (e.g. "USD->GHS").
 */
export interface MoneyAggregateMeta {
    currency?: string;
    complete?: boolean;
    missingRates?: string[];
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardSummary extends MoneyAggregateMeta {
    totalAssets?: number;
    activeAssets?: number;
    assetsInUse?: number;
    /** Purchase cost of every non-disposed asset, in `currency`. */
    totalAssetValue?: number;
    /** Book value of every non-disposed asset, in `currency`. */
    netBookValue?: number;
    inMaintenanceAssets?: number;
    disposedAssets?: number;
    totalOrganisations?: number;
    totalUsers?: number;
    pendingPOs?: number;
    pendingPurchaseOrders?: number;
    openPurchaseOrders?: number;
    approvedPOs?: number;
    pendingApprovals?: number;
    scheduledMaintenance?: number;
    upcomingMaintenanceCount?: number;
    overdueMaintenanceCount?: number;
    maintenanceAlerts?: number;
    inProgressMaintenance?: number;
    assetsNeedingMaintenance?: number;
    expiredLicenses?: number;
    totalWebhooks?: number;
    activeWebhooks?: number;
    generatedAt?: string;
}

export interface AssetsByStatus extends MoneyAggregateMeta {
    data: {
        name: string;
        count: number;
        value: number;
        percentage: number;
    }[];
    total: number;
    totalValue: number;
}

export interface MaintenanceAlerts {
    alertCount: number;
    criticalCount: number;
    warningCount: number;
    scheduledCount: number;
    alerts: {
        message: string;
        assetName: string;
        severity: string;
        dueDate?: string;
        nextDueDate?: string;
        daysOverdue?: number;
    }[];
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface AssetAnalytics extends MoneyAggregateMeta {
    period: string;
    groupBy: string;
    data: {
        name: string;
        count: number;
        value: number;
        percentage: number;
    }[];
    total: number;
    totalValue: number;
}

/**
 * Portfolio figures (totalAssets, totalAssetValue, netBookValue, depreciation,
 * breakdown) are as of today across every non-disposed asset; `period` only
 * filters activity (acquisitions, maintenance, disposals).
 */
export interface FinancialAnalytics extends MoneyAggregateMeta {
    period: string;
    totalAssets?: number;
    totalAssetValue: number;
    totalDepreciation: number;
    netBookValue: number;
    acquisitionsInPeriod?: number;
    totalAcquisition?: number;
    totalDisposal?: number;
    totalMaintenance?: number;
    totalBudget?: number;
    totalActualSpend?: number;
    budgetUtilization?: number;
    assetTurnover?: number;
    averageAssetAge?: number;
    depreciationMethod?: string;
    assetsFullyDepreciated?: number;
    assetsMissingDepreciationSetup?: number;
    monthlyDepreciation?: number;
    breakdown: {
        byCategory: Record<string, {
            count: number;
            value: number;
            netBookValue?: number;
            monthlyDepreciation: number;
        }>;
    };
}

export interface PurchaseOrderAnalytics extends MoneyAggregateMeta {
    period: string;
    totalPOs: number;
    draftPOs: number;
    approvedPOs: number;
    rejectedPOs: number;
    totalPOValue: number;
    averagePOValue: number;
    largestPO?: number;
    smallestPO?: number;
    averageApprovalTime?: number;
    averageDeliveryTime?: number;
    topSuppliers: {
        supplier: string;
        poCount: number;
        totalValue: number;
    }[];
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export interface ReportRequest {
    format?: string;
}

export interface ReportResponse {
    reportId?: string;
    format: string;
    status: string;
    reportType?: string;
    type?: string;
    downloadUrl?: string;
    generatedAt: string;
    rowCount?: number;
    maintenanceRecords?: number;
    pages?: number;
    size?: string;
}

export interface ReportHistory {
    totalReports: number;
    limit: number;
    offset: number;
    reports: ReportResponse[];
}

// ─── Bulk Operations ──────────────────────────────────────────────────────────
export interface ImportJobStatus {
    jobId: string;
    status: string;
    totalRows: number;
    successCount: number;
    errorCount: number;
    warnings: { rowNumber: number; message: string; }[];
    startedAt: string;
    completedAt: string | null;
    downloadErrorReportUrl: string | null;
}

export interface ExportJobRequest {
    format: string;
    filters?: Record<string, unknown>;
    columns?: string[];
}

export interface ExportJobResponse {
    jobId: string;
    status: string;
    message?: string;
    format: string;
    downloadUrl: string;
    startedAt: string;
    estimatedRows: number;
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export interface Webhook {
    id: string;
    name: string;
    url?: string;
    events: string[];
    active: boolean;
    secret?: string;
    createdAt?: string;
    lastTriggeredAt?: string | null;
    deliveryCount: number;
    failureCount?: number;
    lastFailureAt?: string;
}

export interface WebhookDelivery {
    deliveryId: string;
    timestamp: string;
    event: string;
    status: string;
    statusCode: number;
    responseTime: number;
    attempts: number;
    requestBody?: string | null;
    responseBody?: string | null;
    nextRetryAt?: string | null;
    deliveredAt?: string | null;
}

// ─── Notifications ────────────────────────────────────────────────────────────
export type NotificationType =
    | "DEPRECATION"
    | "MAINTENANCE"
    | "APPROVAL"
    | "SYSTEM"
    | "TRANSFER"
    | "DISPOSAL"
    | "PURCHASE_ORDER";

export const NOTIFICATION_TYPES: NotificationType[] = [
    "DEPRECATION",
    "MAINTENANCE",
    "APPROVAL",
    "SYSTEM",
    "TRANSFER",
    "DISPOSAL",
    "PURCHASE_ORDER",
];

export interface Notification {
    /** Backend may return either field name */
    id?: string;
    notificationId?: string;
    type: NotificationType | string;
    title: string;
    message: string;
    entityId?: string;
    createdAt: string;
    read: boolean;
    readAt?: string;
    actionUrl?: string;
}

export interface NotificationPreferences {
    /** Per-type email toggle keyed by NotificationType */
    emailNotifications: Record<string, boolean>;
    pushNotifications?: boolean;
    inAppNotifications?: boolean;
    dailyDigest: boolean;
    digestTime: string;
}

export interface NotificationSummary {
    totalNotifications?: number;
    unreadCount?: number;
    byType?: Record<string, number>;
}

// ─── Health & Monitoring ──────────────────────────────────────────────────────
export interface SystemHealth {
    status: string;
    timestamp: string;
    components: Record<string, unknown>;
}

export interface DetailedHealth extends SystemHealth {
    uptime: string;
    version: string;
}

export interface HealthJvmMetrics {
    heapUsedBytes?: number;
    heapMaxBytes?: number;
    heapCommittedBytes?: number;
    nonHeapUsedBytes?: number;
    nonHeapCommittedBytes?: number;
    threadCount?: number;
    daemonThreadCount?: number;
    processCpuLoad?: number;
    systemCpuLoad?: number;
    availableProcessors?: number;
}

export interface DatabaseMetrics {
    status?: string;
    poolName?: string;
    activeConnections?: number;
    idleConnections?: number;
    totalConnections?: number;
    maxConnections?: number;
    minConnections?: number;
    pendingThreads?: number;
    usagePercent?: number;
    responseTimeMs?: number;
    details?: Record<string, unknown>;
}

export interface ApiMetrics {
    period: string;
    timestamp: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: string;
    averageLatency: number;
    jvm?: HealthJvmMetrics | null;
    database?: DatabaseMetrics | null;
    uptime?: string;
    uptimeMs?: number;
    p50Latency?: number;
    p95Latency?: number;
    p99Latency?: number;
    maxLatency?: number;
    errorRate?: string;
    topErrors?: { error: string; count: number; percentage: string; }[];
    slowestEndpoints?: { endpoint: string; avgLatency: number; callCount: number; }[];
    raw?: Record<string, unknown>;
}

export interface EndpointMetric {
    endpoint: string;
    method: string;
    requests: number;
    averageLatency: number;
    errorRate: string;
    successRate: string;
}

export interface ThroughputMetric {
    hour: string;
    requestCount: number;
    successCount: number;
    errorCount: number;
    averageLatency: number;
}

export interface ErrorMetric {
    errorCode: string;
    errorType: string;
    count: number;
    percentage: string;
    lastOccurrence: string;
}

// ─── Billing ──────────────────────────────────────────────────────────────────
/** Billing intervals the backend emits. */
export type BillingInterval = "MONTHLY" | "ANNUALLY";

export interface BillingPlan {
    code: string;
    name: string;
    tier: string;
    /** Optional so callers guard it — older payloads have omitted it. */
    interval?: BillingInterval | null;
    amountMinor: number;
    currency: string;
    maxAssets: number;
    maxEmployees: number;
    /** Not every backend version reports a department limit. */
    maxDepartments?: number | null;
    analyticsEnabled: boolean;
    auditRetentionDays: number;
}

export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";

export interface Subscription {
    id: string;
    organisationId: string;
    plan: BillingPlan;
    status: SubscriptionStatus;
    autoRenew: boolean;
    autoRenewEnabled?: boolean;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextBillingAt?: string | null;
    canceledAt?: string | null;
    pastDueSince?: string | null;
    /** While PAST_DUE, paid features stay on until this instant. */
    graceEndsAt?: string | null;
    /** A pending downgrade, applied at scheduledChangeAt (period end). */
    scheduledPlan?: BillingPlan | null;
    scheduledChangeAt?: string | null;
    currentAssetCount: number;
    currentEmployeeCount: number;
    currentDepartmentCount?: number;
}

export interface CheckoutInitRequest {
    planCode: string;
    callbackUrl: string;
}

export interface CheckoutInitResponse {
    authorizationUrl: string;
    accessCode: string;
    reference: string;
}

export interface ChangePlanRequest {
    planCode: string;
    callbackUrl?: string;
}

export type ChangePlanAction = "CHECKOUT" | "SCHEDULED" | "NO_CHANGE";

/** POST /billing/subscription/change-plan */
export interface ChangePlanResponse {
    action: ChangePlanAction;
    checkout: CheckoutInitResponse | null;
    subscription: Subscription;
}

// ─── Audit Events ─────────────────────────────────────────────────────────────
export interface AuditEvent {
    id: string;
    organisationId: string;
    actorId?: string | null;
    actorEmail?: string | null;
    method: string;
    path: string;
    query?: string | null;
    handler?: string | null;
    responseStatus: number;
    success: boolean;
    message?: string | null;
    requestId?: string | null;
    clientIp?: string | null;
    userAgent?: string | null;
    createdAt: string;
}

export interface AuditEventFilterParams {
    actorId?: string;
    start?: string;
    end?: string;
    success?: boolean;
    method?: string;
    path?: string;
}

// ─── Compliance ────────────────────────────────────────────────────────────────
export type ComplianceFramework = "ISO_27001" | "SOC2" | "PCI_DSS" | "ICS" | "BOG";
export type ControlStatus = "NOT_IMPLEMENTED" | "PARTIAL" | "IMPLEMENTED" | "NOT_APPLICABLE";
export type RiskStatus = "OPEN" | "IN_TREATMENT" | "CLOSED" | "ACCEPTED";
export type RiskTreatment = "ACCEPT" | "MITIGATE" | "TRANSFER" | "AVOID";
export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type IncidentSeverity = "P1_CRITICAL" | "P2_HIGH" | "P3_MEDIUM" | "P4_LOW";
export type PolicyStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "RETIRED";
export type VendorSupportStatus = "SUPPORTED" | "END_OF_LIFE" | "END_OF_SUPPORT" | "UNKNOWN";
export type PatchStatus = "PLANNED" | "APPLIED" | "FAILED" | "ROLLED_BACK";
export type ComplianceAnswer = "YES" | "NO" | "NOT_APPLICABLE" | "COMPENSATING_CONTROL";
export type ScanType = "INTERNAL" | "EXTERNAL" | "ASV" | "ICS_OT";
export type ScanStatus = "PASS" | "FAIL" | "PENDING_REMEDIATION";
export type FilingStatus = "PENDING" | "SUBMITTED" | "OVERDUE" | "ACKNOWLEDGED" | "REJECTED";

// 1) Compliance Controls
export interface ComplianceControl {
    id: string;
    organisationId: string;
    framework: ComplianceFramework;
    controlRef: string;
    controlName: string;
    controlDescription?: string | null;
    status: ControlStatus;
    justification?: string | null;
    evidenceUrl?: string | null;
    gapDescription?: string | null;
    remediationPlan?: string | null;
    ownerId?: string | null;
    ownerEmail?: string | null;
    reviewDueDate?: string | null;
    lastReviewedAt?: string | null;
    lastReviewedByEmail?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ComplianceControlDto {
    framework: ComplianceFramework;
    controlRef: string;
    controlName: string;
    controlDescription?: string | null;
    status?: ControlStatus;
    justification?: string | null;
    evidenceUrl?: string | null;
    gapDescription?: string | null;
    remediationPlan?: string | null;
    ownerId?: string | null;
    reviewDueDate?: string | null;
    lastReviewedAt?: string | null;
    lastReviewedByEmail?: string | null;
}

// 2) BOG Controls
export interface BOGControl {
    id: string;
    organisationId: string;
    directiveRef: string;
    requirement: string;
    status: ControlStatus;
    evidenceUrl?: string | null;
    gapDescription?: string | null;
    remediationPlan?: string | null;
    targetDate?: string | null;
    ownerId?: string | null;
    ownerEmail?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface BOGControlDto {
    directiveRef: string;
    requirement: string;
    status?: ControlStatus;
    evidenceUrl?: string | null;
    gapDescription?: string | null;
    remediationPlan?: string | null;
    targetDate?: string | null;
    ownerId?: string | null;
}

// 3) Risk Register
export interface Risk {
    id: string;
    organisationId: string;
    framework?: ComplianceFramework | null;
    riskId?: string | null;
    title: string;
    description?: string | null;
    likelihood: number;
    impact: number;
    riskScore: number;
    treatment?: RiskTreatment | null;
    mitigationPlan?: string | null;
    residualRisk?: number | null;
    status: RiskStatus;
    ownerId?: string | null;
    ownerEmail?: string | null;
    reviewDate?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface RiskDto {
    framework?: ComplianceFramework | null;
    riskId?: string | null;
    title: string;
    description?: string | null;
    likelihood: number;
    impact: number;
    treatment?: RiskTreatment | null;
    mitigationPlan?: string | null;
    residualRisk?: number | null;
    status?: RiskStatus;
    ownerId?: string | null;
    reviewDate?: string | null;
}

// 4) Security Incidents
export interface SecurityIncident {
    id: string;
    organisationId: string;
    title: string;
    description?: string | null;
    severity: IncidentSeverity;
    category?: string | null;
    reportedById?: string | null;
    reportedByEmail?: string | null;
    assignedToId?: string | null;
    assignedToEmail?: string | null;
    detectedAt?: string | null;
    resolvedAt?: string | null;
    rootCause?: string | null;
    lessonsLearned?: string | null;
    status: IncidentStatus;
    createdAt: string;
    updatedAt: string;
}

export interface SecurityIncidentDto {
    title: string;
    description?: string | null;
    severity: IncidentSeverity;
    category?: string | null;
    reportedById?: string | null;
    assignedToId?: string | null;
    detectedAt?: string | null;
    status?: IncidentStatus;
    resolvedAt?: string | null;
    rootCause?: string | null;
    lessonsLearned?: string | null;
}

// 5) Security Policies
export interface SecurityPolicy {
    id: string;
    organisationId: string;
    title: string;
    version?: string | null;
    documentUrl?: string | null;
    ownerId?: string | null;
    ownerEmail?: string | null;
    approvedByEmail?: string | null;
    effectiveDate?: string | null;
    reviewDueDate?: string | null;
    status: PolicyStatus;
    createdAt: string;
    updatedAt: string;
}

export interface SecurityPolicyDto {
    title: string;
    version?: string | null;
    documentUrl?: string | null;
    ownerId?: string | null;
    reviewDueDate?: string | null;
    status?: PolicyStatus;
    approvedByEmail?: string | null;
    effectiveDate?: string | null;
}

// 6) Security Zones
export interface SecurityZone {
    id: string;
    organisationId: string;
    name: string;
    purdueLevel: number;
    description?: string | null;
    allowedProtocols?: string | null;
    assetCount?: number;
    networkRange?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SecurityZoneDto {
    name: string;
    purdueLevel: number;
    description?: string | null;
    allowedProtocols?: string | null;
    networkRange?: string | null;
    assetCount?: number;
}

// 7) ICS Assets
export interface ICSAsset {
    id: string;
    organisationId: string;
    assetId: string;
    assetName?: string | null;
    securityZoneId?: string | null;
    securityZoneName?: string | null;
    firmwareVersion?: string | null;
    protocol?: string | null;
    vendorSupportStatus?: VendorSupportStatus | null;
    lastPatchedAt?: string | null;
    knownVulnerabilities?: string | null;
    isolated?: boolean;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ICSAssetDto {
    assetId: string;
    securityZoneId?: string | null;
    firmwareVersion?: string | null;
    protocol?: string | null;
    vendorSupportStatus?: VendorSupportStatus | null;
    lastPatchedAt?: string | null;
    knownVulnerabilities?: string | null;
    isolated?: boolean;
    notes?: string | null;
}

// 8) Patch Records
export interface PatchRecord {
    id: string;
    organisationId: string;
    assetId: string;
    assetName?: string | null;
    patchName: string;
    version?: string | null;
    appliedAt?: string | null;
    appliedByEmail?: string | null;
    testEnvironmentValidated?: boolean;
    rollbackPlan?: string | null;
    status: PatchStatus;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PatchRecordDto {
    assetId: string;
    patchName: string;
    version?: string | null;
    appliedAt?: string | null;
    appliedByEmail?: string | null;
    testEnvironmentValidated?: boolean;
    rollbackPlan?: string | null;
    status?: PatchStatus;
    notes?: string | null;
}

// 9) PCI SAQ Records
export interface PCISAQRecord {
    id: string;
    organisationId: string;
    requirementNumber: string;
    requirementText?: string | null;
    complianceStatus?: ComplianceAnswer | null;
    compensatingControl?: string | null;
    evidenceUrl?: string | null;
    targetDate?: string | null;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PCISAQDto {
    requirementNumber: string;
    requirementText?: string | null;
    complianceStatus?: ComplianceAnswer | null;
    compensatingControl?: string | null;
    evidenceUrl?: string | null;
    targetDate?: string | null;
    notes?: string | null;
}

// 10) SLA Metrics
export interface SLAMetric {
    id: string;
    organisationId: string;
    month: number;
    year: number;
    uptimePercent: number;
    plannedDowntimeMinutes?: number;
    unplannedDowntimeMinutes?: number;
    incidentCount?: number;
    rtoMinutes?: number;
    rpoMinutes?: number;
    slaBreached?: boolean;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SLAMetricDto {
    month: number;
    year: number;
    uptimePercent: number;
    plannedDowntimeMinutes?: number;
    unplannedDowntimeMinutes?: number;
    incidentCount?: number;
    rtoMinutes?: number;
    rpoMinutes?: number;
    slaBreached?: boolean;
    notes?: string | null;
}

// 11) Vulnerability Scans
export interface VulnerabilityScan {
    id: string;
    organisationId: string;
    scanDate: string;
    scannerTool?: string | null;
    scanType: ScanType;
    criticalCount?: number;
    highCount?: number;
    mediumCount?: number;
    lowCount?: number;
    status?: ScanStatus | null;
    reportUrl?: string | null;
    nextScanDue?: string | null;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface VulnerabilityScanDto {
    scanDate: string;
    scannerTool?: string | null;
    scanType: ScanType;
    criticalCount?: number;
    highCount?: number;
    mediumCount?: number;
    lowCount?: number;
    status?: ScanStatus | null;
    reportUrl?: string | null;
    nextScanDue?: string | null;
    notes?: string | null;
}

// 12) Regulatory Filings
export interface RegulatoryFiling {
    id: string;
    organisationId: string;
    filingType: string;
    regulator: string;
    dueDate: string;
    submittedAt?: string | null;
    reference?: string | null;
    status: FilingStatus;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface RegulatoryFilingDto {
    filingType: string;
    regulator: string;
    dueDate: string;
    status?: FilingStatus;
    submittedAt?: string | null;
    reference?: string | null;
    notes?: string | null;
}

// PaginatedResponse is defined earlier in this file (near line 633). Duplicate removed.

// ─── Software Licenses ───────────────────────────────────────────────────────

/** Mirrors com.assetiq.enums.LicenseType. */
export const LICENSE_TYPES = ["PERPETUAL", "SUBSCRIPTION", "VOLUME", "OPEN_SOURCE", "TRIAL", "ENTERPRISE", "OEM"] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];
export type LicenseStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "SUSPENDED" | "CANCELLED";

/** Mirrors com.assetiq.dto.SoftwareLicenseDto. */
export interface SoftwareLicense {
    id: string;
    name: string;
    vendor: string;
    productName?: string | null;
    version?: string | null;
    licenseType: LicenseType;
    status: LicenseStatus;
    totalSeats?: number | null;
    usedSeats?: number | null;
    /** Computed by the API: totalSeats - usedSeats. */
    availableSeats?: number | null;
    purchaseCost?: number | null;
    annualRenewalCost?: number | null;
    currency?: string | null;
    purchaseDate?: string | null;
    expiryDate?: string | null;
    renewalDate?: string | null;
    autoRenew?: boolean | null;
    licenseDocumentUrl?: string | null;
    notes?: string | null;
    assetId?: string | null;
    organisationId?: string | null;
    daysUntilExpiry?: number | null;
}

export interface SoftwareLicenseDto {
    name: string;                 // required
    vendor: string;               // required
    productName?: string | null;
    version?: string | null;
    licenseType: LicenseType;     // required
    status?: LicenseStatus;
    totalSeats?: number | null;
    usedSeats?: number | null;
    purchaseCost?: number | null;
    annualRenewalCost?: number | null;
    currency?: string | null;
    purchaseDate?: string | null;
    expiryDate?: string | null;
    renewalDate?: string | null;
    autoRenew?: boolean | null;
    licenseDocumentUrl?: string | null;
    notes?: string | null;
}

/** GET /licenses/utilization */
export interface LicenseUtilization {
    totalLicenses: number;
    activeLicenses: number;
    totalSeats: number;
    usedSeats: number;
    availableSeats: number;
    utilizationPct: number;
    expiringSoon30Days: number;
    overAllocated: number;
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export type ContractType = "PURCHASE" | "LEASE" | "MAINTENANCE" | "SERVICE_LEVEL_AGREEMENT" | "WARRANTY" | "INSURANCE" | "OTHER";
export type ContractStatus = "DRAFT" | "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "TERMINATED" | "RENEWED";

export interface Contract {
    id: string;
    title: string;
    contractType: ContractType;
    status: ContractStatus;
    supplierId?: string | null;
    supplierName?: string | null;
    startDate: string;
    endDate: string;
    value: number;
    currency?: string | null;
    autoRenew: boolean;
    /** Key terms / free-text notes (API field `notes`). */
    notes?: string | null;
    organisationId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ContractDto {
    title: string;
    contractType: ContractType;
    status?: ContractStatus;
    supplierId?: string | null;
    startDate: string;
    endDate: string;
    value: number;
    currency?: string | null;
    autoRenew?: boolean;
    notes?: string | null;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export type ExpenseCategory =
    | "MAINTENANCE"
    | "TRAVEL"
    | "SUPPLIES"
    | "SOFTWARE"
    | "HARDWARE"
    | "INSURANCE"
    | "OTHER";

export type ExpenseStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface Expense {
    id?: string;
    title?: string;
    description?: string;
    amount?: number;
    currency?: string;
    category?: ExpenseCategory;
    status?: ExpenseStatus;
    receiptUrl?: string;
    rejectionReason?: string;
    approvedAt?: string;
    createdAt?: string;
    organisationId?: string;
    submittedById?: string;
    submittedByName?: string;
    approvedById?: string;
    linkedAssetId?: string;
    linkedBudgetId?: string;
    departmentId?: string;
    expenseDate?:      string;   // ISO date yyyy-MM-dd
    linkedBudgetName?: string;
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export type BudgetStatus = "DRAFT" | "ACTIVE" | "EXCEEDED" | "CLOSED";

export interface Budget {
    id: string;
    name: string;
    description?: string | null;
    status: BudgetStatus;
    totalAmount: number;
    spentAmount: number;
    remainingAmount: number;
    committedAmount:   number;
    availableAmount:   number;
    alertThresholdPct: number;
    forecastedSpend?:  number;
    currency?: string | null;
    fiscalYear?: number | null;
    departmentId?: string | null;
    departmentName?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    organisationId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface BudgetDepartmentSummary {
    departmentId:   string | null;
    departmentName: string;
    allocated:      number;
    spent:          number;
    committed:      number;
    available:      number;
}

export interface BudgetSummary extends MoneyAggregateMeta {
    totalAllocated:  number;
    totalSpent:      number;
    totalCommitted:  number;
    totalAvailable:  number;
    byDepartment:    BudgetDepartmentSummary[];
}

/** Mirrors com.assetiq.enums.BudgetStatus. EXCEEDED is set by the API from the figures. */
export const BUDGET_STATUSES = ["DRAFT", "ACTIVE", "EXCEEDED", "CLOSED"] as const;

export interface BudgetDto {
    name: string;
    description?: string | null;
    status?: BudgetStatus;
    totalAmount: number;
    currency?: string | null;
    fiscalYear?: number | null;
    departmentId?: string | null;
    periodStart: string;          // required by the API
    periodEnd: string;            // required by the API
    alertThresholdPct?: number | null;
}

export type BudgetLedgerKind =
    | "ADJUSTMENT"
    | "PO_COMMIT" | "PO_RELEASE" | "PO_SPEND" | "PO_SPEND_REVERSAL"
    | "EXPENSE_COMMIT" | "EXPENSE_RELEASE" | "EXPENSE_SPEND" | "EXPENSE_SPEND_REVERSAL";

/** GET /budgets/{id}/ledger row. amount is positive; the deltas are signed. */
export interface BudgetLedgerEntry {
    id: string;
    kind: BudgetLedgerKind;
    amount: number;
    currency: string;
    spentDelta: number;
    committedDelta: number;
    spentAfter: number;
    committedAfter: number;
    sourceType: "PURCHASE_ORDER" | "EXPENSE" | "ADJUSTMENT" | string;
    sourceId?: string | null;
    actorEmail?: string | null;
    note?: string | null;
    createdAt: string;
}

export interface BudgetSpendDto {
    amount: number;
}

// ─── Vendor Reviews ───────────────────────────────────────────────────────────

export interface VendorReview {
    id: string;
    supplierId: string;
    supplierName?: string | null;
    rating: number;
    qualityScore?: number | null;
    deliveryScore?: number | null;
    supportScore?: number | null;
    feedback?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    reviewedById?: string | null;
    reviewedByEmail?: string | null;
}

export interface VendorReviewDto {
    supplierId: string;
    rating: number;
    qualityScore?: number | null;
    deliveryScore?: number | null;
    supportScore?: number | null;
    feedback?: string | null;
    reviewedById?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
}

export interface VendorReviewSummary {
    supplierId: string;
    supplierName?: string | null;
    totalReviews: number;
    averageRating: number;
    avgQualityScore?: number;
    avgDeliveryScore?: number;
    avgSupportScore?: number;
    avgOverallScore?: number;
}

// ─── MFA ──────────────────────────────────────────────────────────────────────

export interface MfaSetupResponse {
    secret: string;
    qrCodeImage: string;
    message: string;
}

export interface MfaVerifyDto {
    code: string;
}

export interface MfaDisableDto {
    code: string;
}

/** Response body from POST /mfa/step-up (the access cookie is re-issued too). */
export interface MfaStepUpResponse {
    /** Epoch seconds of the fresh authenticator check. */
    mfaAuthenticatedAt: number;
}

// ─── SSO Configuration (org-scoped) ──────────────────────────────────────────

export interface OrgSsoConfig {
    id?: string | null;
    provider?: string | null;
    enabled: boolean;
    clientId?: string | null;
    issuerUri?: string | null;
    /** Space-separated, e.g. "openid email profile" (a single string on the API). */
    scopes?: string | null;
    redirectUri?: string | null;
    idpMetadataUrl?: string | null;
    spEntityId?: string | null;
    assertionConsumerServiceUrl?: string | null;
    emailDomain?: string | null;
}

export interface SsoOAuth2Dto {
    provider: string;
    clientId: string;
    clientSecret: string;
    issuerUri: string;
    /** Space-separated, e.g. "openid email profile" (a single string on the API). */
    scopes?: string | null;
    redirectUri?: string | null;
    emailDomain?: string | null;
}

export interface SsoSamlDto {
    provider: string;
    idpMetadataUrl: string;
    spEntityId: string;
    assertionConsumerServiceUrl: string;
    emailDomain?: string | null;
}

export interface SsoToggleDto {
    enabled: boolean;
}

export interface SsoDiscoverResponse {
    ssoEnabled: boolean;
    organisationId?: string | null;
    provider?: string | null;
}

// ─── Dashboard Additions ──────────────────────────────────────────────────────

export interface AssetsByDepartment extends MoneyAggregateMeta {
    data: {
        departmentId: string;
        departmentName: string;
        count: number;
        value: number;
        percentage?: number;
    }[];
    total: number;
    totalValue: number;
}

export interface DepreciationSummary extends MoneyAggregateMeta {
    totalAssetValue?: number;
    totalDepreciation: number;
    netBookValue: number;
    assetsFullyDepreciated: number;
    /** Non-disposed assets with a cost but no useful life anywhere (carried at cost). */
    assetsMissingDepreciationSetup?: number;
    monthlyDepreciation: number;
    byMethod?: Record<string, { count: number; totalDepreciation: number }>;
}

// ─── Analytics Additions ──────────────────────────────────────────────────────

export interface MaintenanceAnalytics extends MoneyAggregateMeta {
    period?: string;
    totalRecords?: number;
    totalMaintenanceCost: number;
    averageCost: number;
    completionRate?: number;
    overdueCount: number;
    byType: Record<string, { count: number; cost: number }>;
}

export interface DepreciationTrendPoint {
    month: string;
    totalDepreciation: number;
    netBookValue: number;
    newDepreciation?: number;
}

export interface DepreciationTrend extends MoneyAggregateMeta {
    period?: string;
    data: DepreciationTrendPoint[];
}

// ─── IT Asset Discovery ───────────────────────────────────────────────────────

export type DiscoveredDeviceStatus = "ONLINE" | "OFFLINE" | "UNKNOWN" | "PROMOTED";

export interface DiscoveredDevice {
    id: string;
    ipAddress: string;
    hostname?: string | null;
    macAddress?: string | null;
    deviceType?: string | null;
    openPorts?: number[] | null;
    discoveryMethod?: string | null;
    status: DiscoveredDeviceStatus;
    osHint?: string | null;
    responseTimeMs?: number | null;
    lastSeenAt?: string | null;
    promotedAssetId?: string | null;
    organisationId?: string | null;
    createdAt: string;
    updatedAt?: string | null;
}

export interface DiscoveryScanDto {
    cidrRange?: string | null;
    ipAddresses?: string[] | null;
    portScan?: boolean;
    ports?: number[] | null;
    timeoutMs?: number | null;
}

export interface DiscoverySummary {
    total: number;
    online: number;
    offline: number;
    promoted: number;
}

// ─── Cloud Assets ─────────────────────────────────────────────────────────────

export type CloudProvider = "AWS" | "AZURE" | "GCP" | "ALIBABA" | "ORACLE_CLOUD" | "IBM_CLOUD" | "OTHER";
export type CloudResourceType =
    | "VIRTUAL_MACHINE"
    | "STORAGE_BUCKET"
    | "DATABASE"
    | "LOAD_BALANCER"
    | "CONTAINER"
    | "SERVERLESS_FUNCTION"
    | "NETWORK"
    | "CDN"
    | "DNS"
    | "KUBERNETES_CLUSTER"
    | "VPN_GATEWAY"
    | "CACHE"
    | "MESSAGE_QUEUE"
    | "OTHER";
/** The API's CloudEnvironment enum; null means "not set". */
export type CloudEnvironment = "PROD" | "STAGING" | "DEV" | "TEST" | "OTHER";
export type CloudAssetStatus = "RUNNING" | "STOPPED" | "TERMINATED" | "PENDING" | "UNKNOWN";

export interface CloudAsset {
    id: string;
    name: string;
    provider: CloudProvider;
    region: string;
    resourceId: string;
    resourceType: CloudResourceType;
    status: CloudAssetStatus;
    accountId?: string | null;
    monthlyCostEstimate?: number | null;
    currency?: string | null;
    environment?: CloudEnvironment | null;
    tags?: string | null;
    description?: string | null;
    lastSyncAt?: string | null;
    organisationId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CloudAssetDto {
    name: string;
    provider: CloudProvider;
    region: string;
    resourceId: string;
    resourceType: CloudResourceType;
    status?: CloudAssetStatus;
    accountId?: string | null;
    monthlyCostEstimate?: number | null;
    currency?: string | null;
    environment?: CloudEnvironment | null;
    tags?: string | null;
    description?: string | null;
}

export interface CloudCostSummary extends MoneyAggregateMeta {
    totalMonthlyCost: number;
    currency: string;
    costByProvider: Record<string, number>;
    costByEnvironment: Record<string, number>;
    topAssets?: { assetName: string; resourceType: string; monthlyCost: number }[];
    /** Month (YYYY-MM) whose recorded actuals replace estimates in the totals. */
    actualsMonth?: string | null;
    /** Assets counted at recorded actuals rather than their estimate. */
    assetsWithActuals?: number;
}

export interface CloudMonthlyCostDto {
    billingMonth: string;
    amount: number;
    serviceName?: string | null;
}

/** GET /cloud-assets/{id}/costs item: one recorded month (and sub-service) of cost. */
export interface CloudCostRecord {
    id: string;
    /** YYYY-MM */
    billingMonth: string;
    amount: number;
    currency?: string | null;
    serviceName?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

// ─── Document Attachments ─────────────────────────────────────────────────────

export type AttachmentEntityType =
    | 'EXPENSE'
    | 'COMPLIANCE_CONTROL'
    | 'BOG_CONTROL'
    | 'SECURITY_POLICY'
    | 'PCI_SAQ'
    | 'CONTRACT'
    | 'DISPOSAL_RECORD'
    | 'VULNERABILITY_SCAN';

export interface DocumentAttachment {
    id:             string;
    entityType:     AttachmentEntityType;
    entityId:       string;
    originalName:   string;
    contentType:    string;
    fileSize:       number;
    uploadedByName?: string;
    createdAt:      string;
    downloadUrl?:   string;
}

// ─── AI / Predictive Intelligence ────────────────────────────────────────────

export type InsightType =
    | "MAINTENANCE_DUE"
    | "FAILURE_RISK"
    | "WARRANTY_EXPIRY"
    | "DEPRECIATION_COMPLETE"
    | "ASSET_AGING"
    | "ANOMALY"
    | "UNDERUTILIZED"
    | "LICENSE_EXPIRY";

export type InsightSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface PredictiveInsight {
    id: string;
    assetId: string;
    assetName?: string | null;
    assetTag?: string | null;
    insightType: InsightType;
    severity: InsightSeverity;
    title: string;
    description: string;
    confidence: number;
    predictedDate?: string | null;
    resolved: boolean;
    resolvedAt?: string | null;
    organisationId?: string | null;
    createdAt: string;
    updatedAt?: string | null;
}

export interface InsightSummary {
    totalUnresolved: number;
    bySeverity: Record<InsightSeverity, number>;
}

export interface InsightFilterParams {
    type?: InsightType;
    severity?: InsightSeverity;
    unresolvedOnly?: boolean;
}
