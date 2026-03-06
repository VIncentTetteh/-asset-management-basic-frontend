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
    format: string;
    includeDetails: boolean;
    filters: Record<string, unknown>;
    columns: string[];
}

export interface ReportResponse {
    reportId?: string;
    format: string;
    status: string;
    downloadUrl: string;
    generatedAt: string;
    rowCount: number;
    size?: string;
    generatedBy?: string;
    type?: string;
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
export interface Notification {
    notificationId: string;
    type: string;
    title: string;
    message: string;
    entityId?: string;
    createdAt: string;
    read: boolean;
    actionUrl?: string;
}

export interface NotificationPreferences {
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
