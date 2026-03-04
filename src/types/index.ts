// ─── Base ─────────────────────────────────────────────────────────────────────
export interface BaseEntity {
    id: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    modifiedBy?: string;
}

// ─── Organisation ─────────────────────────────────────────────────────────────
export type OrganisationStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

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
export type DepartmentStatus = "ACTIVE" | "INACTIVE";

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
    NEW = "NEW",
    GOOD = "GOOD",
    FAIR = "FAIR",
    POOR = "POOR",
    DAMAGED = "DAMAGED",
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
    DOUBLE_DECLINING_BALANCE = "DOUBLE_DECLINING_BALANCE",
    SUM_OF_YEARS_DIGITS = "SUM_OF_YEARS_DIGITS",
    UNITS_OF_PRODUCTION = "UNITS_OF_PRODUCTION",
}

// ─── Asset ────────────────────────────────────────────────────────────────────
export interface Asset extends BaseEntity {
    name: string;
    assetTag?: string;
    serialNumber?: string;
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
}

// ─── Category ─────────────────────────────────────────────────────────────────
export interface Category extends BaseEntity {
    name: string;
    description?: string;
    parentCategoryId?: string | null;
    depreciationPolicyId?: string;
    defaultWarrantyPeriodMonths?: number;
    organisationId?: string;
}

export interface CategoryDto {
    id?: string;
    name: string;                         // required
    description?: string;
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
    permissions: string[];
    organisationId?: string;
    isSystemRole?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface RoleDto {
    name: string;                 // required
    description?: string;
    permissions: string[];        // array of Permission values
}

// ─── User ─────────────────────────────────────────────────────────────────────
export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

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
    departmentId?: string;
    password?: string;            // required on creation only
    status?: UserStatus | string;
}

// ─── Purchase Order ───────────────────────────────────────────────────────────
export enum POStatus {
    DRAFT = "DRAFT",
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    ORDERED = "ORDERED",
    RECEIVED = "RECEIVED",
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
    organisationId: string;       // required
    departmentId: string;         // required
    supplierId: string;           // required
}

// ─── Maintenance ──────────────────────────────────────────────────────────────
export enum MaintenanceType {
    PREVENTIVE = "PREVENTIVE",
    CORRECTIVE = "CORRECTIVE",
    PREDICTIVE = "PREDICTIVE",
    CONDITION_BASED = "CONDITION_BASED",
}

export enum MaintenanceStatus {
    SCHEDULED = "SCHEDULED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    OVERDUE = "OVERDUE",
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
    AUCTION = "AUCTION",
    SCRAP = "SCRAP",
    DONATION = "DONATION",
    RETURN_TO_VENDOR = "RETURN_TO_VENDOR",
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
}

// ─── Supplier ─────────────────────────────────────────────────────────────────
export type SupplierStatus = "ACTIVE" | "INACTIVE" | "BLACKLISTED";

export interface Supplier extends BaseEntity {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
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
    residualValuePercentage?: number;
    description?: string;
    organisationId?: string;
}

export interface DepreciationPolicyDto {
    id?: string;
    name: string;                 // required
    method: DepreciationMethod | string;  // required
    usefulLifeMonths?: number;
    residualValuePercentage?: number;
    description?: string;
    organisationId?: string;
}
