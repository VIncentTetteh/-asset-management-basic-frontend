export interface BaseEntity {
    id: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    modifiedBy?: string;
}

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
    status?: string;
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
    status?: string;
}

export interface Department extends BaseEntity {
    name: string;
    departmentCode?: string;
    parentDepartmentId?: string | null;
    managerId?: string;
    costCenterCode?: string;
    budgetLimit?: number;
    status?: string;
    organisationId: string;
}

export interface DepartmentDto {
    id?: string;
    name: string;
    departmentCode?: string;
    parentDepartmentId?: string | null;
    managerId?: string;
    costCenterCode?: string;
    budgetLimit?: number;
    status?: string;
    organisationId: string;
}

export enum AssetState {
    REGISTERED = "REGISTERED",
    ASSIGNED = "ASSIGNED",
    SCRAPPED = "SCRAPPED",
    // New states
    IN_USE = "IN_USE",
    IN_STOCK = "IN_STOCK",
    MAINTENANCE = "MAINTENANCE",
    DISPOSED = "DISPOSED",
    RETIRED = "RETIRED",
    MISSING = "MISSING"
}

export enum AssetCondition {
    NEW = "NEW",
    EXCELLENT = "EXCELLENT",
    GOOD = "GOOD",
    FAIR = "FAIR",
    DAMAGED = "DAMAGED",
    SCRAP = "SCRAP"
}

export enum AssetType {
    HARDWARE = "HARDWARE",
    SOFTWARE = "SOFTWARE",
    FURNITURE = "FURNITURE",
    VEHICLE = "VEHICLE",
    EQUIPMENT = "EQUIPMENT",
    OTHER = "OTHER"
}

export enum DepreciationMethod {
    STRAIGHT_LINE = "STRAIGHT_LINE",
    DECLINING_BALANCE = "DECLINING_BALANCE",
    UNITS_OF_PRODUCTION = "UNITS_OF_PRODUCTION",
    SUM_OF_YEARS_DIGITS = "SUM_OF_YEARS_DIGITS"
}

export interface Asset extends BaseEntity {
    name: string;
    assetTag?: string;
    serialNumber?: string;
    barcodeQrCode?: string;
    description?: string;
    categoryId?: string;
    category?: string; // legacy
    assetType?: AssetType | string;
    manufacturer?: string;
    model?: string;
    purchaseDate?: string;
    purchaseCost?: number;
    currency?: string;
    depreciationMethod?: DepreciationMethod | string;
    usefulLifeMonths?: number;
    usefulLifeInYears?: number; // legacy
    residualValue?: number;
    warrantyExpiryDate?: string;
    status?: AssetState | string;
    state?: AssetState | string; // legacy
    condition?: AssetCondition | string;
    locationId?: string;
    assignedUserId?: string;
    supplierId?: string;
    departmentId?: string;
    organisationId?: string;
}

export interface AssetDto {
    id?: string;
    name: string;
    assetTag?: string;
    serialNumber?: string;
    barcodeQrCode?: string;
    description?: string;
    categoryId?: string;
    category?: string;
    assetType?: AssetType | string;
    manufacturer?: string;
    model?: string;
    purchaseDate?: string;
    purchaseCost?: number;
    currency?: string;
    depreciationMethod?: DepreciationMethod | string;
    usefulLifeMonths?: number;
    usefulLifeInYears?: number;
    residualValue?: number;
    warrantyExpiryDate?: string;
    status?: AssetState;
    condition?: AssetCondition | string;
    locationId?: string;
    assignedUserId?: string;
    supplierId?: string;
    departmentId?: string;
    organisationId?: string;
}

export interface Category extends BaseEntity {
    name: string;
    description?: string;
    parentCategoryId?: string | null;
    depreciationPolicyId?: string;
    defaultWarrantyPeriodMonths?: number;
    assetPrefixCode?: string;
    organisationId?: string;
}

export interface CategoryDto {
    id?: string;
    name: string;
    description?: string;
    parentCategoryId?: string | null;
    depreciationPolicyId?: string;
    defaultWarrantyPeriodMonths?: number;
    assetPrefixCode?: string;
    organisationId?: string;
}

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
    name: string;
    description?: string;
    permissions: string[];
    organisationId?: string;
    isSystemRole?: boolean;
}

export interface User extends BaseEntity {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    employeeId?: string;
    jobTitle?: string;
    roleId?: string;
    status?: string;
    organisationId?: string;
    departmentId?: string;
}

export interface UserDto {
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password?: string;
    employeeId?: string;
    jobTitle?: string;
    roleId?: string;
    status?: string;
    organisationId?: string;
    departmentId?: string;
}

export enum POStatus {
    DRAFT = "DRAFT",
    PENDING_APPROVAL = "PENDING_APPROVAL",
    SUBMITTED = "SUBMITTED",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    ORDERED = "ORDERED",
    PARTIALLY_DELIVERED = "PARTIALLY_DELIVERED",
    DELIVERED = "DELIVERED",
    CANCELLED = "CANCELLED"
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
    createdAt?: string;
    orderDate?: string;
    expectedDeliveryDate?: string;
}

export interface PurchaseOrderDto {
    id?: string;
    poNumber: string;
    totalAmount: number;
    currency?: string;
    status?: POStatus | string;
    remarks?: string;
    organisationId?: string;
    departmentId?: string;
    supplierId?: string;
    createdAt?: string;
}

export enum MaintenanceType {
    PREVENTIVE = "PREVENTIVE",
    CORRECTIVE = "CORRECTIVE",
    EMERGENCY = "EMERGENCY",
    ROUTINE = "ROUTINE"
}

export interface MaintenanceRecord extends BaseEntity {
    assetId: string;
    type: MaintenanceType | string;
    description?: string;
    scheduledDate: string;
    completedDate?: string;
    performedBy?: string;
    cost?: number;
    status: string;
}

export interface MaintenanceDto {
    id?: string;
    assetId: string;
    type: MaintenanceType | string;
    description?: string;
    scheduledDate: string;
    completedDate?: string;
    performedBy?: string;
    cost?: number;
    status: string;
}


export enum AuditStatus {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    PASSED = "PASSED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}

export interface Audit extends BaseEntity {
    assetId?: string;
    organisationId?: string;
    departmentId?: string;
    auditDate: string;
    conductedById?: string;
    status?: string | AuditStatus;
    remarks?: string;
    notes?: string;
    findings?: string;
}

export interface AuditDto {
    id?: string;
    assetId?: string;
    organisationId?: string;
    departmentId?: string;
    auditDate: string;
    conductedById?: string;
    status?: string;
    remarks?: string;
    notes?: string;
    findings?: string;
}

export enum TransferStatus {
    REQUESTED = "REQUESTED",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    IN_TRANSIT = "IN_TRANSIT",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED"
}

export interface AssetTransfer extends BaseEntity {
    assetId: string;
    fromDepartmentId?: string;
    toDepartmentId?: string;
    fromLocationId?: string;
    toLocationId?: string;
    requestedById?: string;
    reason?: string;
    transferDate?: string;
    status?: TransferStatus | string;
}

export interface AssetTransferDto {
    id?: string;
    assetId: string;
    fromDepartmentId?: string;
    toDepartmentId?: string;
    fromLocationId?: string;
    toLocationId?: string;
    requestedById?: string;
    reason?: string;
    transferDate?: string;
    status?: TransferStatus | string;
}

export enum DisposalMethod {
    SALE = "SALE",
    DONATION = "DONATION",
    SCRAP = "SCRAP",
    RECYCLING = "RECYCLING",
    TRADE_IN = "TRADE_IN",
    RETURN = "RETURN"
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

export interface DisposalRecordDto {
    id?: string;
    assetId: string;
    disposalMethod: DisposalMethod | string;
    disposalDate: string;
    saleValue?: number;
    approvedById?: string;
    reason?: string;
    complianceDocumentUrl?: string;
    organisationId?: string;
}

export interface Location extends BaseEntity {
    name: string;
    address?: string;
    building?: string;
    floor?: string;
    room?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    gpsCoordinates?: string;
    organisationId?: string;
    parentLocationId?: string | null;
}

export interface LocationDto {
    id?: string;
    name: string;
    address?: string;
    building?: string;
    floor?: string;
    room?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    gpsCoordinates?: string;
    organisationId?: string;
    parentLocationId?: string | null;
}

export interface Supplier extends BaseEntity {
    name: string;
    registrationNumber?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    bankDetails?: string;
    taxId?: string;
    website?: string;
    rating?: number;
    status: "ACTIVE" | "INACTIVE";
    organisationId?: string;
}

export interface SupplierDto {
    id?: string;
    name: string;
    registrationNumber?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    bankDetails?: string;
    taxId?: string;
    status?: string;
    website?: string;
    rating?: number;
    organisationId?: string;
}

export interface DepreciationPolicy extends BaseEntity {
    name: string;
    organisationId?: string;
}

export interface DepreciationPolicyDto {
    id?: string;
    name: string;
    organisationId?: string;
}
