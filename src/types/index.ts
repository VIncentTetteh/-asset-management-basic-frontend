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
export type SsoProvider = "GOOGLE" | "MICROSOFT" | "OKTA" | "AUTH0";

export interface SsoConfig extends BaseEntity {
    provider: SsoProvider | string;
    clientId: string;
    clientSecret?: string;
    tenantId?: string;
    discoveryUrl?: string;
    redirectUri?: string;
    enabled: boolean;
    organisationId?: string;
}

export interface SsoConfigDto {
    provider: SsoProvider | string;    // required
    clientId: string;                  // required
    clientSecret: string;              // required
    tenantId?: string;
    discoveryUrl?: string;
    redirectUri?: string;
    enabled: boolean;
}

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
    organisationId?: string;
    currentBookValue?: number;
}

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
    currentBookValue?: number;
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
    permissions: string[] | string;
    organisationId?: string;
    isSystemRole?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface RoleDto {
    name: string;                 // required
    description?: string;
    permissions: string[] | string;
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
    roleId?: string;
    status?: UserStatus | string;
    organisationId?: string;
    departmentId?: string;
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
    status?: POStatus | string;
    remarks?: string;
    organisationId?: string;
    departmentId?: string;
    supplierId?: string;
}

export interface PurchaseOrderDto {
    id?: string;
    poNumber: string;             // required, unique within org
    totalAmount: number;          // required
    currency?: string;
    status?: POStatus | string;
    remarks?: string;
    departmentId: string;         // required
    supplierId: string;           // required
    organisationId: string;
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
    description?: string;
    scheduledDate?: string;
    vendorId?: string;
    cost?: number;
    currency?: string;
    status?: MaintenanceStatus | string;
    nextDueDate?: string;
    performedDate?: string;
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
    auditDate: string;
    conductedById?: string;
    status?: AuditStatus | string;
    remarks?: string;
}

export interface AssetAuditDto {
    id?: string;
    organisationId: string;       // required
    departmentId: string;         // required
    auditDate: string;            // required
    conductedById: string;        // required
    status?: AuditStatus | string;
    remarks?: string;
}

// ─── Asset Transfer ───────────────────────────────────────────────────────────
export enum TransferStatus {
    REQUESTED = "REQUESTED",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    IN_TRANSIT = "IN_TRANSIT",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
}

export interface AssetTransfer extends BaseEntity {
    assetId: string;
    fromDepartmentId?: string;
    toDepartmentId?: string;
    fromLocationId?: string;
    toLocationId?: string;
    requestedById?: string;
    approvedById?: string;
    transferDate?: string;
    reason?: string;
    status?: TransferStatus | string;
}

export interface AssetTransferDto {
    id?: string;
    assetId: string;              // required
    fromDepartmentId: string;     // required
    toDepartmentId: string;       // required
    fromLocationId?: string;
    toLocationId?: string;
    requestedById: string;        // required
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

export interface DisposalRecord extends BaseEntity {
    assetId: string;
    disposalMethod: DisposalMethod | string;
    disposalDate: string;
    saleValue?: number;
    approvedById?: string;
    reason?: string;
    complianceDocumentUrl?: string;
    organisationId?: string;
}

export interface DisposalsDto {
    id?: string;
    assetId: string;              // required
    disposalMethod: DisposalMethod | string;  // required
    disposalDate: string;         // required
    saleValue?: number;
    approvedById: string;         // required
    reason?: string;
    complianceDocumentUrl?: string;
    organisationId?: string;
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
    bankDetails?: string;
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
    bankDetails?: string;
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
    usefulLifeMonths?: number;
    salvageValuePercent?: number;
    description?: string;
    organisationId?: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginResponse {
    token: string;
    expiresIn: number;
    tokenType: string;
    user: User;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardSummary {
    totalAssets: number;
    assetsInUse: number;
    assetsInStock: number;
    assetsRetired: number;
    pendingPurchaseOrders: number;
    approvedPurchaseOrders: number;
    totalAssetValue: number;
    totalPendingValue: number;
    assetsNeedingMaintenance: number;
    deprecatedAssets: number;
    lastUpdated: string;
    totalDepreciation: number;
    maintenanceAlerts: number;
}

export interface AssetsByStatus {
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
        dueDate: string;
    }[];
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface AssetAnalytics {
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

export interface FinancialAnalytics {
    period: string;
    totalAssetValue: number;
    totalDepreciation: number;
    netBookValue: number;
    totalAcquisition: number;
    totalDisposal: number;
    totalMaintenance: number;
    assetTurnover: number;
    averageAssetAge: number;
    depreciationMethod: string;
    assetsFullyDepreciated: number;
    monthlyDepreciation: number;
    breakdown: {
        byCategory: Record<string, {
            count: number;
            value: number;
            monthlyDepreciation: number;
        }>;
    };
}

export interface PurchaseOrderAnalytics {
    period: string;
    totalPOs: number;
    draftPOs: number;
    approvedPOs: number;
    rejectedPOs: number;
    totalPOValue: number;
    averagePOValue: number;
    largestPO: number;
    smallestPO: number;
    averageApprovalTime: number;
    averageDeliveryTime: number;
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
    filters: Record<string, unknown>;
    columns: string[];
}

export interface ExportJobResponse {
    jobId: string;
    status: string;
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

export interface ApiMetrics {
    period: string;
    timestamp: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: string;
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    maxLatency: number;
    errorRate: string;
    topErrors: { error: string; count: number; percentage: string; }[];
    slowestEndpoints: { endpoint: string; avgLatency: number; callCount: number; }[];
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
export interface BillingPlan {
    code: string;
    name: string;
    tier: string;
    interval: "MONTHLY" | "YEARLY" | string;
    amountMinor: number;
    currency: string;
    maxAssets: number;
    maxEmployees: number;
    analyticsEnabled: boolean;
    auditRetentionDays: number;
}

export interface Subscription {
    id: string;
    organisationId: string;
    plan: BillingPlan;
    status: string;
    autoRenew: boolean;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextBillingAt?: string | null;
    currentAssetCount: number;
    currentEmployeeCount: number;
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

export interface PaginatedResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    first?: boolean;
    last?: boolean;
}

// ─── Software Licenses ───────────────────────────────────────────────────────

export type LicenseType = "SUBSCRIPTION" | "PERPETUAL" | "VOLUME" | "NODE_LOCKED" | "OPEN_SOURCE" | "TRIAL" | "ENTERPRISE" | "OEM";
export type LicenseStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "SUSPENDED" | "CANCELLED";

export interface SoftwareLicense {
    id: string;
    productName: string;
    licenseType: LicenseType;
    status: LicenseStatus;
    licenseKey?: string | null;
    vendor?: string | null;
    seats: number;
    allocatedSeats: number;
    purchaseDate?: string | null;
    expiryDate?: string | null;
    monthlyCost?: number | null;
    currency?: string | null;
    supplierId?: string | null;
    organisationId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SoftwareLicenseDto {
    productName: string;
    licenseType: LicenseType;
    status?: LicenseStatus;
    licenseKey?: string | null;
    vendor?: string | null;
    seats: number;
    allocatedSeats?: number;
    purchaseDate?: string | null;
    expiryDate?: string | null;
    monthlyCost?: number | null;
    currency?: string | null;
    supplierId?: string | null;
}

export interface LicenseUtilization {
    totalLicenses: number;
    totalSeats: number;
    totalAllocated: number;
    utilizationPct: number;
    overAllocatedCount: number;
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
    terms?: string | null;
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
    terms?: string | null;
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export type BudgetStatus = "DRAFT" | "ACTIVE" | "EXCEEDED" | "CLOSED";

export interface Budget {
    id: string;
    name: string;
    status: BudgetStatus;
    allocatedAmount: number;
    spentAmount: number;
    remainingAmount: number;
    currency?: string | null;
    fiscalYear?: number | null;
    departmentId?: string | null;
    departmentName?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    organisationId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface BudgetDto {
    name: string;
    status?: BudgetStatus;
    allocatedAmount: number;
    currency?: string | null;
    fiscalYear?: number | null;
    departmentId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
}

export interface BudgetSpendDto {
    amount: number;
}

// ─── Vendor Reviews ───────────────────────────────────────────────────────────

export interface VendorReview {
    id: string;
    supplierId: string;
    supplierName?: string | null;
    reviewPeriod: string;
    qualityScore: number;
    deliveryScore: number;
    supportScore: number;
    overallScore: number;
    comments?: string | null;
    reviewedById?: string | null;
    reviewDate: string;
    organisationId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface VendorReviewDto {
    supplierId: string;
    reviewPeriod: string;
    qualityScore: number;
    deliveryScore: number;
    supportScore: number;
    overallScore?: number;
    comments?: string | null;
    reviewedById?: string | null;
    reviewDate: string;
}

export interface VendorReviewSummary {
    supplierId: string;
    supplierName?: string | null;
    totalReviews: number;
    avgQualityScore: number;
    avgDeliveryScore: number;
    avgSupportScore: number;
    avgOverallScore: number;
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

// ─── SSO Configuration (org-scoped) ──────────────────────────────────────────

export interface OrgSsoConfig {
    id?: string | null;
    provider?: string | null;
    enabled: boolean;
    clientId?: string | null;
    issuerUri?: string | null;
    scopes?: string[] | null;
    redirectUri?: string | null;
    idpMetadataUrl?: string | null;
    spEntityId?: string | null;
    assertionConsumerServiceUrl?: string | null;
}

export interface SsoOAuth2Dto {
    provider: string;
    clientId: string;
    clientSecret: string;
    issuerUri: string;
    scopes?: string[];
    redirectUri?: string | null;
}

export interface SsoSamlDto {
    provider: string;
    idpMetadataUrl: string;
    spEntityId: string;
    assertionConsumerServiceUrl: string;
}

export interface SsoToggleDto {
    enabled: boolean;
}

// ─── Dashboard Additions ──────────────────────────────────────────────────────

export interface AssetsByDepartment {
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

export interface DepreciationSummary {
    totalDepreciation: number;
    netBookValue: number;
    assetsFullyDepreciated: number;
    monthlyDepreciation: number;
    byMethod?: Record<string, { count: number; totalDepreciation: number }>;
}

// ─── Analytics Additions ──────────────────────────────────────────────────────

export interface MaintenanceAnalytics {
    period?: string;
    totalMaintenanceCost: number;
    averageCost: number;
    completionRate: number;
    overdueCount: number;
    byType: Record<string, { count: number; cost: number }>;
}

export interface DepreciationTrendPoint {
    month: string;
    totalDepreciation: number;
    netBookValue: number;
    newDepreciation?: number;
}

export interface DepreciationTrend {
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
export type CloudEnvironment = "PROD" | "STAGING" | "DEV";
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
    environment: CloudEnvironment;
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
    environment: CloudEnvironment;
    tags?: string | null;
    description?: string | null;
}

export interface CloudCostSummary {
    totalMonthlyCost: number;
    currency: string;
    costByProvider: Record<string, number>;
    costByEnvironment: Record<string, number>;
    topAssets?: { assetName: string; resourceType: string; monthlyCost: number }[];
}

export interface CloudMonthlyCostDto {
    billingMonth: string;
    amount: number;
    serviceName?: string | null;
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
