# Enterprise Asset Management — Complete API Reference

**Base URL:** `http://localhost:8080`
**API Version:** v1
**Content-Type:** `application/json` (unless stated otherwise)

---

## Table of Contents

1. [Authentication & Headers](#1-authentication--headers)
2. [Enums Reference](#2-enums-reference)
3. [Auth](#3-auth)
4. [Assets](#4-assets)
5. [Purchase Orders](#5-purchase-orders)
6. [Maintenance](#6-maintenance)
7. [Asset Transfers](#7-asset-transfers)
8. [Disposals](#8-disposals)
9. [Software Licenses](#9-software-licenses)
10. [Contracts](#10-contracts)
11. [Budgets](#11-budgets)
12. [Vendors & Suppliers](#12-vendors--suppliers)
13. [Depreciation Policies](#13-depreciation-policies)
14. [Audits & Audit Events](#14-audits--audit-events)
15. [Notifications](#15-notifications)
16. [MFA](#16-mfa)
17. [SSO Configuration](#17-sso-configuration)
18. [Analytics](#18-analytics)
19. [Reports](#19-reports)
20. [Dashboard](#20-dashboard)
21. [Billing & Subscriptions](#21-billing--subscriptions)
22. [Compliance](#22-compliance)
23. [Webhooks *(Phase 2)*](#23-webhooks-phase-2)
24. [Bulk Operations *(Phase 2)*](#24-bulk-operations-phase-2)
25. [Health & Monitoring *(Phase 2)*](#25-health--monitoring-phase-2)
26. [IT Asset Discovery *(Phase 3)*](#26-it-asset-discovery-phase-3)
27. [Cloud Assets *(Phase 3)*](#27-cloud-assets-phase-3)
28. [AI / Predictive Intelligence *(Phase 3)*](#28-ai--predictive-intelligence-phase-3)
29. [Categories](#29-categories)
30. [System Config (Depts, Locs, Roles, Users, Orgs)](#30-system-config)
31. [Asset Checkouts](#31-asset-checkouts)
32. [Expenses](#32-expenses)
33. [Lease Records](#33-lease-records)
34. [Exchange Rates](#34-exchange-rates)
35. [Data Privacy (DPA & DSAR)](#35-data-privacy)


---

## 1. Authentication & Headers

Every authenticated request must include:

| Header | Value | Description |
|--------|-------|-------------|
| `Authorization` | `Bearer <jwt_token>` | JWT from login response |
| `X-Organisation-Id` | `<uuid>` | Tenant organisation UUID |
| `Content-Type` | `application/json` | Required for POST/PUT/PATCH |

### Roles

| Role | Description |
|------|-------------|
| `ROLE_ADMIN` | System-wide administrator |
| `ROLE_ORG_ADMIN` | Organisation administrator |
| `ROLE_USER` | Standard user (read-mostly) |

### Common Error Responses

```json
// 400 Bad Request
{ "requestId": "uuid", "message": "Validation failed", "status": 400, "timestamp": "..." }

// 401 Unauthorized
{ "requestId": "uuid", "message": "Token has been invalidated", "status": 401, "timestamp": "..." }

// 403 Forbidden
{ "requestId": "uuid", "message": "Access denied", "status": 403, "timestamp": "..." }

// 404 Not Found
{ "requestId": "uuid", "message": "Resource not found", "status": 404, "timestamp": "..." }

// 409 Conflict
{ "requestId": "uuid", "message": "Duplicate entry", "status": 409, "timestamp": "..." }
```

---

## 2. Enums Reference

### AssetStatus
```
PENDING_PROCUREMENT  – PO raised, not yet received
IN_STOCK             – Received, not yet assigned
RESERVED             – Earmarked for assignment
IN_USE               – Assigned and actively used
MAINTENANCE          – Scheduled maintenance
UNDER_REPAIR         – With vendor / undergoing repair
RETIRED              – End-of-life, no longer in use
DISPOSED             – Disposed / sold / scrapped
MISSING              – Cannot be located
```

### AssetCondition
```
NEW | EXCELLENT | GOOD | FAIR | DAMAGED | SCRAP
```

### AssetType
```
HARDWARE | SOFTWARE | FURNITURE | VEHICLE | EQUIPMENT | OTHER
```

### DepreciationMethod
```
STRAIGHT_LINE | DECLINING_BALANCE | UNITS_OF_PRODUCTION | SUM_OF_YEARS_DIGITS
```

### ProcurementType
```
CAPEX  – Capital Expenditure
OPEX   – Operating Expenditure
```

### POStatus
```
DRAFT | SUBMITTED | APPROVED | REJECTED | DELIVERED | CANCELLED
```
> Note: `"PENDING"` maps to `SUBMITTED` (backward-compatible alias).

### MaintenanceType
```
PREVENTIVE | CORRECTIVE | EMERGENCY | ROUTINE
```

### MaintenanceStatus
```
SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
```

### TransferStatus
```
REQUESTED | APPROVED | REJECTED | IN_TRANSIT | COMPLETED | CANCELLED
```

### DisposalMethod
```
SALE | DONATION | SCRAP | RECYCLING | TRADE_IN | RETURN
```

### LicenseType
```
PERPETUAL | SUBSCRIPTION | VOLUME | OPEN_SOURCE | TRIAL | ENTERPRISE | OEM
```

### LicenseStatus
```
ACTIVE | EXPIRING_SOON | EXPIRED | SUSPENDED | CANCELLED
```

### ContractType
```
PURCHASE | LEASE | MAINTENANCE | SERVICE_LEVEL_AGREEMENT | WARRANTY | INSURANCE | OTHER
```

### ContractStatus
```
DRAFT | ACTIVE | EXPIRING_SOON | EXPIRED | TERMINATED | RENEWED
```

### BudgetStatus
```
DRAFT | ACTIVE | EXCEEDED | CLOSED
```

### AuditStatus
```
PLANNED | IN_PROGRESS | COMPLETED | DISCREPANCY_FOUND | RESOLVED
```

### NotificationType
```
DEPRECATION | MAINTENANCE | APPROVAL | SYSTEM | TRANSFER | DISPOSAL | PURCHASE_ORDER
```

### SupplierStatus
```
ACTIVE | INACTIVE | SUSPENDED | BLACKLISTED
```

### UserStatus
```
ACTIVE | INACTIVE | SUSPENDED | TERMINATED
```

### SsoProvider
```
GOOGLE | AZURE_AD | OKTA | GITHUB | SAML | CUSTOM_OAUTH2
```

### BillingPlanTier
```
FREEMIUM | BASIC | BUSINESS | ENTERPRISE
```

### BillingInterval
```
MONTHLY | ANNUALLY
```

### SubscriptionStatus
```
ACTIVE | PAST_DUE | CANCELED | EXPIRED
```

### PaymentStatus
```
PENDING | SUCCESS | FAILED | ABANDONED
```

### OrganisationStatus
```
ACTIVE | SUSPENDED | INACTIVE | DELETED
```

### CloudProvider *(Phase 3)*
```
AWS | AZURE | GCP | ALIBABA | ORACLE_CLOUD | IBM_CLOUD | OTHER
```

### CloudResourceType *(Phase 3)*
```
VIRTUAL_MACHINE | STORAGE_BUCKET | DATABASE | LOAD_BALANCER | CONTAINER
SERVERLESS_FUNCTION | NETWORK | CDN | DNS | KUBERNETES_CLUSTER
VPN_GATEWAY | CACHE | MESSAGE_QUEUE | OTHER
```

### CloudAssetStatus *(Phase 3)*
```
RUNNING | STOPPED | TERMINATED | PENDING | UNKNOWN
```

### DiscoveryMethod *(Phase 3)*
```
PING | PORT_SCAN | MANUAL
```

### DeviceStatus *(Phase 3)*
```
ONLINE | OFFLINE | UNKNOWN | PROMOTED
```

### InsightType *(Phase 3)*
```
MAINTENANCE_DUE      – Maintenance overdue or due within 30 days
FAILURE_RISK         – High maintenance frequency or bad condition
WARRANTY_EXPIRY      – Warranty expiring within 60 days
DEPRECIATION_COMPLETE– Book value ≤ residual value but still IN_USE
ASSET_AGING          – Asset >80% through its useful life
ANOMALY              – Detected anomalous behaviour
UNDERUTILIZED        – High-value asset idle for >180 days
LICENSE_EXPIRY       – Software license nearing expiry
```

### InsightSeverity *(Phase 3)*
```
LOW | MEDIUM | HIGH | CRITICAL
```

---

## 3. Auth

### POST `/api/v1/auth/register`
Register a new user.

**Request**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane.doe@company.com",
  "phone": "+233201234567",
  "password": "SecurePass123!",
  "jobTitle": "IT Manager",
  "organisationId": "0fd33fdf-63ee-4b62-a331-6c43322a2cb0",
  "roleId": "uuid-of-role"
}
```

**Response** `201`
```json
{
  "id": "uuid",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane.doe@company.com",
  "role": "ROLE_USER"
}
```

---

### POST `/api/v1/auth/login`
Authenticate and receive JWT.

**Request**
```json
{
  "email": "jane.doe@company.com",
  "password": "SecurePass123!",
  "organisationId": "0fd33fdf-63ee-4b62-a331-6c43322a2cb0"
}
```

**Response** `200`
```json
{
  "token": "eyJhbGciOiJIUzM4NCJ9...",
  "expiresIn": 86400,
  "user": {
    "id": "uuid",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane.doe@company.com",
    "role": "ROLE_ORG_ADMIN",
    "organisationId": "0fd33fdf-63ee-4b62-a331-6c43322a2cb0"
  }
}
```

---

### POST `/api/v1/auth/refresh`
Refresh JWT token.

**Headers:** `Authorization: Bearer <token>`

**Response** `200`
```json
{ "token": "eyJhbGciOiJIUzM4NCJ9...", "expiresIn": 86400 }
```

---

### GET `/api/v1/auth/profile`
Get current user profile.

**Response** `200`
```json
{
  "id": "uuid",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane.doe@company.com",
  "jobTitle": "IT Manager",
  "role": "ROLE_ORG_ADMIN",
  "organisationId": "uuid",
  "mfaEnabled": false,
  "status": "ACTIVE"
}
```

---

### POST `/api/v1/auth/forgot-password`
Request password reset email.

**Request**
```json
{ "email": "jane.doe@company.com" }
```

**Response** `200`
```json
{ "message": "Password reset instructions sent if the email exists." }
```

---

### POST `/api/v1/auth/reset-password`
Reset password using token from email.

**Request**
```json
{ "token": "reset-token-from-email", "newPassword": "NewPass456!" }
```

**Response** `200`
```json
{ "message": "Password reset successfully." }
```

---

### POST `/api/v1/auth/logout`
Invalidate JWT.

**Headers:** `Authorization: Bearer <token>`

**Response** `200`
```json
{ "message": "Logged out successfully." }
```

---

## 4. Assets

**Required Role:** `ROLE_ADMIN` (write), `ROLE_ORG_ADMIN` / `ROLE_USER` (read)

### Asset Object
```json
{
  "id": "uuid",
  "name": "Dell Latitude 5540",
  "assetTag": "ASSET-001",
  "serialNumber": "SN-12345",
  "barcodeQrCode": "QR-12345",
  "description": "Laptop for IT department",
  "assetType": "HARDWARE",
  "manufacturer": "Dell",
  "model": "Latitude 5540",
  "purchaseDate": "2023-06-01",
  "purchaseCost": 1200.00,
  "currency": "USD",
  "depreciationMethod": "STRAIGHT_LINE",
  "usefulLifeMonths": 60,
  "residualValue": 100.00,
  "currentBookValue": 940.00,
  "warrantyExpiryDate": "2026-06-01",
  "status": "IN_USE",
  "condition": "GOOD",
  "procurementType": "CAPEX",
  "costCenter": "IT-OPS-001",
  "categoryId": "uuid",
  "locationId": "uuid",
  "departmentId": "uuid",
  "assignedUserId": "uuid",
  "supplierId": "uuid",
  "purchaseOrderId": "uuid",
  "organisationId": "uuid",
  "createdAt": "2023-06-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

---

### POST `/api/v1/assets`
Create a new asset.

**Request** — same fields as Asset Object above (omit `id`, `createdAt`, `updatedAt`, `currentBookValue`)

**Response** `201` — full Asset Object

---

### GET `/api/v1/assets`
List all assets for the tenant.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `status` | AssetStatus | Filter by status |
| `departmentId` | UUID | Filter by department |
| `categoryId` | UUID | Filter by category |

**Response** `200` — `Array<AssetObject>`

---

### GET `/api/v1/assets/{id}`
Get asset by ID.

**Response** `200` — Asset Object

---

### PUT `/api/v1/assets/{id}`
Full update of an asset.

**Request** — full Asset Object (without readonly fields)

**Response** `200` — updated Asset Object

---

### PATCH `/api/v1/assets/{id}`
Partial update of an asset.

**Request** — any subset of Asset Object fields

**Response** `200` — updated Asset Object

---

### DELETE `/api/v1/assets/{id}`
Soft-delete an asset.

**Response** `204 No Content`

---

### POST `/api/v1/assets/{id}/assign/{departmentId}`
Assign asset to a department.

**Response** `200` — updated Asset Object

---

### POST `/api/v1/assets/{id}/assign-user/{userId}`
Assign asset to a user.

**Response** `200` — updated Asset Object

---

### DELETE `/api/v1/assets/{id}/assign-user`
Unassign current user from asset.

**Response** `200` — updated Asset Object

---

### GET `/api/v1/assets/{id}/qrcode`
Generate and download QR code PNG for asset.

**Response** `200`
- Content-Type: `image/png`
- Body: raw PNG bytes

---

### GET `/api/v1/assets/{id}/history`
Chronological history of asset changes and events.

**Response** `200`
```json
[
  {
    "event": "ASSIGNED",
    "description": "Assigned to Jane Doe",
    "performedBy": "admin@company.com",
    "timestamp": "2024-01-15T09:00:00Z"
  }
]
```

---

### POST `/api/v1/assets/import`
Import assets from Excel file.

**Content-Type:** `multipart/form-data`

**Form Fields**

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | `.xlsx` Excel file |

**Response** `200`
```json
{
  "totalRows": 50,
  "imported": 48,
  "skipped": 2,
  "dryRun": false,
  "errors": [
    { "row": 5, "message": "Duplicate asset tag: ASSET-005" },
    { "row": 12, "message": "Invalid status value: 'UNKNOWN'" }
  ]
}
```

---

## 5. Purchase Orders

**Required Role:** `ROLE_ADMIN` (write), `ROLE_ADMIN` / `ROLE_USER` (read)

### Purchase Order Object
```json
{
  "id": "uuid",
  "poNumber": "PO-2025-001",
  "status": "SUBMITTED",
  "totalAmount": 5000.00,
  "currency": "USD",
  "supplierId": "uuid",
  "departmentId": "uuid",
  "approvedById": "uuid",
  "approvedAt": "2025-01-15T10:00:00Z",
  "remarks": "Quarterly laptop procurement",
  "lineItems": [
    {
      "id": "uuid",
      "description": "Dell Latitude 5540",
      "quantity": 5,
      "unitPrice": 1000.00,
      "totalPrice": 5000.00
    }
  ],
  "createdAt": "2025-01-10T00:00:00Z"
}
```

### POST `/api/v1/purchase-orders`
Create a purchase order.

**Response** `201` — Purchase Order Object

---

### GET `/api/v1/purchase-orders`

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `status` | POStatus | Filter by status |
| `supplierId` | UUID | Filter by supplier |
| `departmentId` | UUID | Filter by department |

**Response** `200` — `Array<PurchaseOrderObject>`

---

### GET `/api/v1/purchase-orders/{id}`
**Response** `200` — Purchase Order Object

---

### PUT `/api/v1/purchase-orders/{id}` | PATCH `/api/v1/purchase-orders/{id}`
**Response** `200` — updated Purchase Order Object

---

### POST `/api/v1/purchase-orders/{id}/approve`
Approve a purchase order.

**Response** `200` — updated PO with `status: "APPROVED"`

---

### POST `/api/v1/purchase-orders/{id}/reject`
Reject a purchase order.

**Response** `200` — updated PO with `status: "REJECTED"`

---

### DELETE `/api/v1/purchase-orders/{id}`
**Response** `204 No Content`

---

## 6. Maintenance

**Required Role:** `ROLE_ADMIN` (write), `ROLE_ADMIN` / `ROLE_USER` (read)

### Maintenance Record Object
```json
{
  "id": "uuid",
  "assetId": "uuid",
  "assetName": "HP ProLiant Server",
  "maintenanceType": "PREVENTIVE",
  "description": "Annual hardware inspection",
  "scheduledDate": "2025-03-01",
  "performedDate": "2025-03-02",
  "vendorId": "uuid",
  "cost": 350.00,
  "status": "COMPLETED",
  "nextDueDate": "2026-03-01",
  "createdAt": "2025-02-20T00:00:00Z"
}
```

### POST `/api/v1/maintenance`
Create maintenance record.

**Response** `201` — Maintenance Record Object

---

### GET `/api/v1/maintenance`

**Query Parameters** *(mutually exclusive)*

| Param | Type | Description |
|-------|------|-------------|
| `assetId` | UUID | Filter by asset |
| `vendorId` | UUID | Filter by vendor |
| `dueBefore` | LocalDate (`YYYY-MM-DD`) | Filter by next due date |

**Response** `200` — `Array<MaintenanceRecordObject>`

---

### GET `/api/v1/maintenance/{id}`
**Response** `200` — Maintenance Record Object

---

### PUT `/api/v1/maintenance/{id}` | PATCH `/api/v1/maintenance/{id}`
**Response** `200`

---

### POST `/api/v1/maintenance/{id}/complete`
Mark a maintenance record as completed.

**Response** `200` — updated record with `status: "COMPLETED"`

---

### DELETE `/api/v1/maintenance/{id}`
**Response** `204`

---

## 7. Asset Transfers

**Required Role:** `ROLE_ADMIN` (write/approve), `ROLE_ADMIN` / `ROLE_USER` (read/create)

### Transfer Object
```json
{
  "id": "uuid",
  "assetId": "uuid",
  "assetName": "Dell Latitude 5540",
  "fromDepartmentId": "uuid",
  "toDepartmentId": "uuid",
  "requestedById": "uuid",
  "approvedById": "uuid",
  "status": "APPROVED",
  "reason": "Department restructuring",
  "transferDate": "2025-04-01",
  "createdAt": "2025-03-20T00:00:00Z"
}
```

### POST `/api/v1/asset-transfers`
**Response** `201`

---

### GET `/api/v1/asset-transfers`

**Query Parameters** *(mutually exclusive)*

| Param | Type | Description |
|-------|------|-------------|
| `assetId` | UUID | |
| `fromDepartmentId` | UUID | |
| `toDepartmentId` | UUID | |
| `requestedById` | UUID | |

**Response** `200` — `Array<TransferObject>`

---

### POST `/api/v1/asset-transfers/{id}/approve`
**Response** `200`

---

### POST `/api/v1/asset-transfers/{id}/reject`
**Response** `200`

---

### POST `/api/v1/asset-transfers/{id}/complete`
**Response** `200`

---

### DELETE `/api/v1/asset-transfers/{id}`
**Response** `204`

---

## 8. Disposals

**Required Role:** `ROLE_ADMIN` (write), `ROLE_ADMIN` / `ROLE_USER` (read)

### Disposal Record Object
```json
{
  "id": "uuid",
  "assetId": "uuid",
  "assetName": "HP ProLiant Server",
  "disposalMethod": "SCRAP",
  "disposalDate": "2025-06-01",
  "salePrice": 0.00,
  "currency": "USD",
  "approvedById": "uuid",
  "certificateOfDestruction": "COD-2025-001",
  "remarks": "End of life after 7 years",
  "createdAt": "2025-05-20T00:00:00Z"
}
```

### POST `/api/v1/disposals`
**Response** `201`

---

### GET `/api/v1/disposals`

**Query Parameters** *(mutually exclusive)*

| Param | Type | Description |
|-------|------|-------------|
| `assetId` | UUID | |
| `startDate` + `endDate` | LocalDate | Date range filter |
| `approvedById` | UUID | |

**Response** `200` — `Array<DisposalObject>`

---

### PUT `/api/v1/disposals/{id}` | PATCH `/api/v1/disposals/{id}`
**Response** `200`

---

### DELETE `/api/v1/disposals/{id}`
**Response** `204`

---

## 9. Software Licenses

**Required Role:** `ROLE_ADMIN` / `ROLE_ORG_ADMIN` (write), all roles (read)

### License Object
```json
{
  "id": "uuid",
  "productName": "Microsoft Office 365",
  "licenseType": "SUBSCRIPTION",
  "status": "ACTIVE",
  "licenseKey": "XXXXX-XXXXX-XXXXX",
  "vendor": "Microsoft",
  "seats": 50,
  "allocatedSeats": 35,
  "purchaseDate": "2024-01-01",
  "expiryDate": "2025-01-01",
  "monthlyCost": 12.50,
  "currency": "USD",
  "supplierId": "uuid",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### POST `/api/v1/licenses`
**Response** `201`

---

### GET `/api/v1/licenses`
**Response** `200` — `Array<LicenseObject>`

---

### GET `/api/v1/licenses/expiring-soon`

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | int | `30` | Expiring within N days |

**Response** `200` — `Array<LicenseObject>`

---

### GET `/api/v1/licenses/over-allocated`
Licenses where `allocatedSeats > seats`.

**Response** `200` — `Array<LicenseObject>`

---

### GET `/api/v1/licenses/utilization`
Organization-wide license seat utilization.

**Response** `200`
```json
{
  "totalLicenses": 10,
  "totalSeats": 500,
  "totalAllocated": 380,
  "utilizationPct": 76.0,
  "overAllocatedCount": 1
}
```

---

### PUT `/api/v1/licenses/{id}` | PATCH `/api/v1/licenses/{id}`
**Response** `200`

---

### DELETE `/api/v1/licenses/{id}`
**Response** `204`

---

## 10. Contracts

**Required Role:** `ROLE_ADMIN` / `ROLE_ORG_ADMIN` (write), all roles (read)

### Contract Object
```json
{
  "id": "uuid",
  "title": "Dell Hardware Support Agreement",
  "contractType": "MAINTENANCE",
  "status": "ACTIVE",
  "supplierId": "uuid",
  "startDate": "2024-01-01",
  "endDate": "2026-12-31",
  "value": 25000.00,
  "currency": "USD",
  "autoRenew": true,
  "terms": "Annual hardware support for all Dell assets",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### POST `/api/v1/contracts`
**Response** `201`

---

### GET `/api/v1/contracts`
**Response** `200` — `Array<ContractObject>`

---

### GET `/api/v1/contracts/expiring-soon`

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | int | `30` | Expiring within N days |

**Response** `200` — `Array<ContractObject>`

---

### PUT `/api/v1/contracts/{id}` | PATCH `/api/v1/contracts/{id}`
**Response** `200`

---

### DELETE `/api/v1/contracts/{id}`
**Response** `204`

---

## 11. Budgets

**Required Role:** `ROLE_ADMIN` / `ROLE_ORG_ADMIN` (write), all roles (read)

### Budget Object
```json
{
  "id": "uuid",
  "name": "IT Equipment FY2025",
  "status": "ACTIVE",
  "allocatedAmount": 100000.00,
  "spentAmount": 45000.00,
  "remainingAmount": 55000.00,
  "currency": "USD",
  "fiscalYear": 2025,
  "departmentId": "uuid",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### POST `/api/v1/budgets`
**Response** `201`

---

### GET `/api/v1/budgets`
**Response** `200` — `Array<BudgetObject>`

---

### POST `/api/v1/budgets/{id}/spend`
Record expenditure against a budget.

**Request**
```json
{ "amount": 5000.00 }
```

**Response** `200` — updated Budget Object

---

### PUT `/api/v1/budgets/{id}` | PATCH `/api/v1/budgets/{id}`
**Response** `200`

---

### DELETE `/api/v1/budgets/{id}`
**Response** `204`

---

## 12. Vendors & Suppliers

### Vendor Performance Review Object
```json
{
  "id": "uuid",
  "supplierId": "uuid",
  "supplierName": "Dell Technologies",
  "reviewPeriod": "Q1-2025",
  "qualityScore": 4.5,
  "deliveryScore": 4.0,
  "supportScore": 4.2,
  "overallScore": 4.23,
  "comments": "Excellent hardware quality, minor delays",
  "reviewedById": "uuid",
  "reviewDate": "2025-04-01",
  "createdAt": "2025-04-01T00:00:00Z"
}
```

### POST `/api/v1/vendor-reviews`
**Auth:** `ROLE_ADMIN` / `ROLE_ORG_ADMIN`

**Response** `201`

---

### GET `/api/v1/vendor-reviews`

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `supplierId` | UUID | Filter by supplier |

**Response** `200` — `Array<VendorReviewObject>`

---

### GET `/api/v1/vendor-reviews/suppliers/{supplierId}/summary`
Aggregated performance summary for a supplier.

**Response** `200`
```json
{
  "supplierId": "uuid",
  "supplierName": "Dell Technologies",
  "totalReviews": 4,
  "avgQualityScore": 4.3,
  "avgDeliveryScore": 4.1,
  "avgSupportScore": 4.2,
  "avgOverallScore": 4.2
}
```

---

### PUT `/api/v1/vendor-reviews/{id}`
**Response** `200`

---

### DELETE `/api/v1/vendor-reviews/{id}`
**Response** `204`

---

## 13. Depreciation Policies

### Depreciation Policy Object
```json
{
  "id": "uuid",
  "name": "Standard IT Equipment Policy",
  "depreciationMethod": "STRAIGHT_LINE",
  "usefulLifeMonths": 60,
  "residualValuePct": 10.0,
  "organisationId": "uuid",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### POST `/api/v1/depreciation-policies`

**Query Parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `organisationId` | UUID | Yes | Target organisation |

**Response** `201`

---

### GET `/api/v1/depreciation-policies`

**Query Parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `organisationId` | UUID | Yes | |

**Response** `200` — `Array<DepreciationPolicyObject>`

---

### PUT `/api/v1/depreciation-policies/{id}` | PATCH `/api/v1/depreciation-policies/{id}`
**Response** `200`

---

### DELETE `/api/v1/depreciation-policies/{id}`
**Response** `204`

---

## 14. Audits & Audit Events

### Asset Audit Object
```json
{
  "id": "uuid",
  "auditName": "Annual IT Asset Audit Q1 2025",
  "status": "IN_PROGRESS",
  "departmentId": "uuid",
  "conductedById": "uuid",
  "startDate": "2025-03-01",
  "endDate": "2025-03-15",
  "notes": "Physical verification of all IT hardware",
  "createdAt": "2025-02-28T00:00:00Z"
}
```

### POST `/api/v1/audits`
**Auth:** `ROLE_ADMIN`

**Response** `201`

---

### GET `/api/v1/audits`

**Query Parameters** *(mutually exclusive)*

| Param | Type | Description |
|-------|------|-------------|
| `departmentId` | UUID | |
| `startDate` + `endDate` | LocalDate | |
| `conductedById` | UUID | |

**Response** `200` — `Array<AuditObject>`

---

### PATCH `/api/v1/audits/{id}/status`
Update audit status.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `status` | AuditStatus | New status value |

**Response** `200` — updated Audit Object

---

### DELETE `/api/v1/audits/{id}`
**Response** `204`

---

### GET `/api/v1/audit-events`
**Auth:** `ROLE_ADMIN`

System audit trail for all actions.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `actorId` | UUID | Filter by user |
| `start` | ISO DateTime | Start of time range |
| `end` | ISO DateTime | End of time range |
| `success` | boolean | Filter by outcome |
| `method` | string | HTTP method filter |

**Response** `200`
```json
[
  {
    "id": "uuid",
    "actorId": "uuid",
    "actorEmail": "admin@company.com",
    "action": "UPDATE_ASSET",
    "entityType": "Asset",
    "entityId": "uuid",
    "httpMethod": "PUT",
    "endpoint": "/api/v1/assets/uuid",
    "ipAddress": "192.168.1.1",
    "success": true,
    "timestamp": "2025-03-12T10:00:00Z"
  }
]
```

---

## 15. Notifications

**Required Role:** All authenticated users

### Notification Object
```json
{
  "id": "uuid",
  "type": "MAINTENANCE",
  "title": "Maintenance Due",
  "message": "Asset 'HP Server' has maintenance due in 3 days.",
  "read": false,
  "createdAt": "2025-03-12T08:00:00Z",
  "readAt": null
}
```

### GET `/api/v1/notifications`

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | NotificationType | — | Filter by type |
| `status` | `all` \| `read` \| `unread` | `all` | Filter by read status |
| `limit` | int | `20` | Max results |

**Response** `200`
```json
{
  "notifications": [ /* Notification Objects */ ],
  "totalUnread": 5,
  "total": 24
}
```

---

### PATCH `/api/v1/notifications/{notificationId}/read`
Mark a notification as read.

**Response** `200`
```json
{
  "notificationId": "uuid",
  "read": true,
  "readAt": "2025-03-12T12:00:00Z"
}
```

---

### PATCH `/api/v1/notifications/mark-all-read`
Mark all notifications as read.

**Response** `200`
```json
{ "markedAsRead": 5 }
```

---

### DELETE `/api/v1/notifications/{notificationId}`
**Response** `204`

---

### DELETE `/api/v1/notifications`
Delete all notifications for current user.

**Response** `200`
```json
{ "deletedCount": 24 }
```

---

### GET `/api/v1/notifications/preferences`
**Response** `200`
```json
{
  "emailEnabled": true,
  "pushEnabled": false,
  "maintenanceAlerts": true,
  "disposalAlerts": true,
  "approvalAlerts": true,
  "systemAlerts": true
}
```

---

### PATCH `/api/v1/notifications/preferences`
**Request** — any subset of preferences fields

**Response** `200` — updated preferences

---

### GET `/api/v1/notifications/summary`
**Response** `200`
```json
{
  "totalUnread": 5,
  "byType": {
    "MAINTENANCE": 2,
    "APPROVAL": 1,
    "SYSTEM": 2
  }
}
```

---

## 16. MFA

**Required Role:** Any authenticated user

### POST `/api/v1/mfa/setup`
Generate TOTP secret and QR code for authenticator app setup.

**Response** `200`
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCodeImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
  "message": "Scan the QR code with your authenticator app, then verify."
}
```

---

### POST `/api/v1/mfa/verify`
Verify TOTP code and enable MFA on the account.

**Request**
```json
{ "code": "123456" }
```

**Response** `200`
```json
{ "message": "MFA enabled successfully." }
```

---

### DELETE `/api/v1/mfa/disable`
Disable MFA (requires current TOTP code to confirm).

**Request**
```json
{ "code": "123456" }
```

**Response** `200`
```json
{ "message": "MFA disabled successfully." }
```

---

## 17. SSO Configuration

**Base Path:** `/api/v1/organisations/{orgId}/sso`
**Required Role:** `ROLE_ADMIN` / `ROLE_ORG_ADMIN`

### GET `/api/v1/organisations/{orgId}/sso`
Get current SSO configuration.

**Response** `200`
```json
{
  "id": "uuid",
  "provider": "GOOGLE",
  "enabled": true,
  "clientId": "client-id",
  "issuerUri": "https://accounts.google.com",
  "scopes": ["openid", "email", "profile"],
  "redirectUri": "https://app.company.com/auth/callback"
}
```

Returns `204 No Content` if not configured.

---

### PUT `/api/v1/organisations/{orgId}/sso/oauth2`
Configure OAuth2 SSO.

**Request**
```json
{
  "provider": "GOOGLE",
  "clientId": "your-google-client-id",
  "clientSecret": "your-client-secret",
  "issuerUri": "https://accounts.google.com",
  "scopes": ["openid", "email", "profile"],
  "redirectUri": "https://app.company.com/auth/callback"
}
```

**Response** `200` — saved config

---

### PUT `/api/v1/organisations/{orgId}/sso/saml`
Configure SAML 2.0 SSO.

**Request**
```json
{
  "provider": "SAML",
  "idpMetadataUrl": "https://idp.company.com/metadata",
  "spEntityId": "https://app.company.com",
  "assertionConsumerServiceUrl": "https://app.company.com/saml/acs"
}
```

**Response** `200` — saved config

---

### PATCH `/api/v1/organisations/{orgId}/sso/toggle`
Enable or disable SSO.

**Request**
```json
{ "enabled": true }
```

**Response** `200` — updated config

---

## 18. Analytics

**Required Role:** `ROLE_ORG_ADMIN` / `ROLE_ADMIN`

### GET `/api/v1/analytics/assets`

**Query Parameters**

| Param | Type | Default | Options |
|-------|------|---------|---------|
| `period` | string | `month` | `week`, `month`, `quarter`, `year` |
| `groupBy` | string | `status` | `status`, `department`, `condition` |

**Response** `200`
```json
{
  "period": "month",
  "groupBy": "status",
  "totalAssets": 250,
  "totalValue": 875000.00,
  "breakdown": {
    "IN_USE": { "count": 180, "value": 650000.00 },
    "IN_STOCK": { "count": 40, "value": 140000.00 },
    "MAINTENANCE": { "count": 15, "value": 52500.00 },
    "RETIRED": { "count": 15, "value": 32500.00 }
  }
}
```

---

### GET `/api/v1/analytics/financial`

**Query Parameters**

| Param | Type | Default |
|-------|------|---------|
| `period` | string | `month` |

**Response** `200`
```json
{
  "period": "month",
  "totalPurchaseValue": 875000.00,
  "totalCurrentBookValue": 620000.00,
  "totalDepreciation": 255000.00,
  "averageAssetAge": 28,
  "byCategory": {
    "Laptops": { "count": 80, "value": 120000.00, "depreciation": 48000.00 },
    "Servers": { "count": 12, "value": 480000.00, "depreciation": 168000.00 }
  }
}
```

---

### GET `/api/v1/analytics/purchase-orders`

**Response** `200`
```json
{
  "period": "month",
  "totalOrders": 12,
  "byStatus": {
    "SUBMITTED": 3,
    "APPROVED": 7,
    "REJECTED": 1,
    "DELIVERED": 1
  },
  "totalValue": 58000.00,
  "averageOrderValue": 4833.33,
  "topSuppliers": [
    { "name": "Dell Technologies", "orderCount": 4, "totalValue": 24000.00 }
  ]
}
```

---

### GET `/api/v1/analytics/maintenance`

**Response** `200`
```json
{
  "totalRecords": 45,
  "overdueCount": 3,
  "totalCost": 28500.00,
  "byType": {
    "PREVENTIVE": 20,
    "CORRECTIVE": 15,
    "EMERGENCY": 5,
    "ROUTINE": 5
  }
}
```

---

### GET `/api/v1/analytics/depreciation-trends`

**Query Parameters**

| Param | Type | Default | Range |
|-------|------|---------|-------|
| `months` | int | `12` | 1–60 |

**Response** `200`
```json
{
  "months": 12,
  "trend": [
    { "month": "2024-03", "bookValue": 700000.00, "depreciationCharge": 18000.00 },
    { "month": "2024-04", "bookValue": 682000.00, "depreciationCharge": 18000.00 }
  ]
}
```

---

## 19. Reports

### POST `/api/v1/reports/assets`
**Auth:** `ROLE_ORG_ADMIN` / `ROLE_ADMIN`

Generate an asset report.

**Request**
```json
{ "format": "PDF" }
```
> `format` values: `PDF`, `EXCEL`, `CSV`

**Response** `200`
```json
{
  "reportId": "uuid",
  "format": "PDF",
  "status": "READY",
  "generatedAt": "2025-03-12T10:00:00Z"
}
```

---

### POST `/api/v1/reports/financial`
Generate a financial report. Same request/response pattern as above.

---

### POST `/api/v1/reports/maintenance`
Generate a maintenance report. Same request/response pattern.

---

### GET `/api/v1/reports/assets/{reportId}/download`
### GET `/api/v1/reports/financial/{reportId}/download`
### GET `/api/v1/reports/maintenance/{reportId}/download`
### GET `/api/v1/reports/{reportId}/download`

Download a generated report.

**Response** `200`
- `Content-Disposition: attachment; filename="report.pdf"`
- `Content-Type: application/pdf` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `text/csv`
- Body: raw file bytes

---

### GET `/api/v1/reports/history`

**Query Parameters**

| Param | Type | Default |
|-------|------|---------|
| `limit` | int | `10` |
| `offset` | int | `0` |

**Response** `200`
```json
{
  "reports": [
    {
      "reportId": "uuid",
      "type": "assets",
      "format": "PDF",
      "filename": "assets-report.pdf",
      "generatedAt": "2025-03-12T10:00:00Z"
    }
  ],
  "total": 25
}
```

---

### DELETE `/api/v1/reports/{reportId}`
**Response** `204`

---

## 20. Dashboard

**Required Role:** `ROLE_ORG_ADMIN` / `ROLE_ADMIN`

### GET `/api/v1/dashboard/summary`

**Response** `200`
```json
{
  "totalAssets": 250,
  "activeAssets": 180,
  "totalAssetValue": 875000.00,
  "pendingApprovals": 5,
  "overdueMaintenanceCount": 3,
  "upcomingMaintenanceCount": 8,
  "openPurchaseOrders": 3,
  "expiredLicenses": 2
}
```

---

### GET `/api/v1/dashboard/assets-by-status`
**Auth:** All roles

**Response** `200`
```json
[
  { "status": "IN_USE", "count": 180, "value": 650000.00, "percentage": 72.0 },
  { "status": "IN_STOCK", "count": 40, "value": 140000.00, "percentage": 16.0 },
  { "status": "MAINTENANCE", "count": 15, "value": 52500.00, "percentage": 6.0 }
]
```

---

### GET `/api/v1/dashboard/assets-by-department`
**Auth:** All roles

**Response** `200`
```json
[
  { "departmentId": "uuid", "departmentName": "IT", "count": 85, "value": 320000.00 },
  { "departmentId": "uuid", "departmentName": "Finance", "count": 30, "value": 45000.00 }
]
```

---

### GET `/api/v1/dashboard/maintenance-alerts`

**Response** `200`
```json
{
  "critical": 3,
  "warning": 5,
  "scheduled": 12,
  "alerts": [
    {
      "assetId": "uuid",
      "assetName": "HP ProLiant Server",
      "nextDueDate": "2025-03-10",
      "daysOverdue": 2,
      "severity": "critical"
    }
  ]
}
```

---

### GET `/api/v1/dashboard/depreciation-summary`

**Response** `200`
```json
{
  "totalPurchaseValue": 875000.00,
  "accumulatedDepreciation": 255000.00,
  "netBookValue": 620000.00,
  "fullyDepreciatedCount": 8,
  "depreciationThisYear": 125000.00
}
```

---

## 21. Billing & Subscriptions

**Required Role:** `ROLE_ADMIN` / `ROLE_ORG_ADMIN`

### GET `/api/v1/billing/plans`
List available subscription plans.

**Response** `200`
```json
[
  {
    "code": "FREEMIUM",
    "name": "Freemium",
    "tier": "FREEMIUM",
    "interval": "MONTHLY",
    "amountMinor": 0,
    "currency": "GHS",
    "maxAssets": 25,
    "maxEmployees": 5,
    "analyticsEnabled": false,
    "auditRetentionDays": 30
  },
  {
    "code": "PLN_basic_monthly",
    "name": "Basic",
    "tier": "BASIC",
    "interval": "MONTHLY",
    "amountMinor": 9900,
    "currency": "GHS",
    "maxAssets": 500,
    "maxEmployees": 50,
    "analyticsEnabled": true,
    "auditRetentionDays": 180
  }
]
```

---

### GET `/api/v1/billing/subscription`
Get current organisation subscription.

**Response** `200`
```json
{
  "id": "uuid",
  "organisationId": "uuid",
  "plan": { /* SubscriptionPlanDto */ },
  "status": "ACTIVE",
  "autoRenew": true,
  "currentPeriodStart": "2025-03-01T00:00:00Z",
  "currentPeriodEnd": "2025-04-01T00:00:00Z",
  "nextBillingAt": "2025-04-01T00:00:00Z",
  "currentAssetCount": 85,
  "currentEmployeeCount": 12
}
```

---

### POST `/api/v1/billing/checkout`
Initialize Paystack checkout session.

**Request**
```json
{
  "planCode": "PLN_basic_monthly",
  "callbackUrl": "https://app.company.com/billing/success"
}
```

**Response** `200`
```json
{
  "authorizationUrl": "https://checkout.paystack.com/xyz123",
  "accessCode": "xyz123",
  "reference": "TXN-20250312-001"
}
```

> Redirect user to `authorizationUrl` to complete payment.

---

### POST `/api/v1/billing/checkout/verify`
Verify Paystack payment after redirect.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `reference` | string | Transaction reference from Paystack callback |

**Response** `200` — updated `OrganisationSubscriptionDto`

---

### PATCH `/api/v1/billing/subscription/auto-renew`
Toggle auto-renewal.

**Request**
```json
{ "enabled": true }
```

**Response** `200` — updated `OrganisationSubscriptionDto`

---

### POST `/api/v1/billing/webhooks/paystack`
*(Public endpoint — no auth required)*

Paystack webhook receiver for payment events.

**Headers**
```
x-paystack-signature: sha512-hmac-signature
```

**Response** `200` — always returns 200 (idempotent)

---

## 22. Compliance

**Required Role:** `ROLE_ADMIN` / `ROLE_ORG_ADMIN`
**Base Path:** `/api/v1/compliance`

All compliance endpoints follow the same pattern:
- `GET /{resource}` — list
- `POST /{resource}` — create
- `GET /{resource}/{id}` — get by ID
- `PATCH /{resource}/{id}` — update
- `DELETE /{resource}/{id}` — soft-delete (where supported)

### Resources

| Resource Path | Description |
|---------------|-------------|
| `/controls` | Compliance controls |
| `/bog-controls` | Bank of Ghana controls |
| `/risks` | Risk register entries *(paginated)* |
| `/incidents` | Security incidents *(paginated)* |
| `/policies` | Security policies |
| `/security-zones` | Network security zones |
| `/ics-assets` | Industrial control system assets |
| `/patch-records` | Patch management records *(paginated, query: `assetId`)* |
| `/pci-saq` | PCI-DSS SAQ records |
| `/sla-metrics` | SLA metrics |
| `/vulnerability-scans` | Vulnerability scan results *(paginated)* |
| `/regulatory-filings` | Regulatory filings *(query: `status`)* |

### Example: Compliance Control Object
```json
{
  "id": "uuid",
  "framework": "ISO 27001",
  "controlId": "A.8.1",
  "title": "Inventory of Assets",
  "description": "All assets shall be identified and an inventory maintained.",
  "status": "COMPLIANT",
  "owner": "IT Manager",
  "evidence": "Asset register maintained in EAM system",
  "lastReviewedAt": "2025-02-01T00:00:00Z",
  "nextReviewDate": "2025-08-01",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

## 23. Webhooks *(Phase 2)*

**Required Role:** `ROLE_ORG_ADMIN` / `ROLE_ADMIN`
**Base Path:** `/api/v1/webhooks`

Webhooks deliver real-time event notifications via HTTP POST to your configured URL, signed with HMAC-SHA256.

### Webhook Object
```json
{
  "id": "uuid",
  "name": "Production Event Listener",
  "url": "https://your-server.com/webhooks/eas",
  "events": ["asset.created", "asset.disposed", "maintenance.overdue"],
  "active": true,
  "secret": "a3f8b2c1...",
  "deliveryCount": 145,
  "failureCount": 2,
  "lastTriggeredAt": "2025-03-12T08:00:00Z",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

> `secret` is only returned on create. Store it immediately for HMAC verification.

### POST `/api/v1/webhooks`
Create a webhook.

**Request**
```json
{
  "name": "Production Event Listener",
  "url": "https://your-server.com/webhooks/eas",
  "events": ["asset.created", "asset.disposed", "maintenance.overdue"],
  "active": true
}
```

**Response** `201` — Webhook Object (includes `secret`)

---

### GET `/api/v1/webhooks`
**Response** `200` — `Array<WebhookObject>` (secret omitted)

---

### GET `/api/v1/webhooks/{id}`
**Response** `200` — Webhook Object (secret omitted)

---

### PATCH `/api/v1/webhooks/{id}`
Update webhook (e.g. change URL, toggle active, update events).

**Request** — any subset of Webhook fields
**Response** `200` — updated Webhook Object

---

### DELETE `/api/v1/webhooks/{id}`
**Response** `204`

---

### POST `/api/v1/webhooks/{id}/test`
Send a test event to verify your endpoint is reachable.

**Response** `200`
```json
{
  "deliveryId": "uuid",
  "webhookId": "uuid",
  "eventName": "webhook.test",
  "payload": "{\"event\":\"webhook.test\",\"data\":{\"message\":\"Test delivery\"}}",
  "statusCode": 200,
  "responseBody": "ok",
  "responseTimeMs": 312,
  "attempts": 1,
  "status": "SUCCESS",
  "triggeredAt": "2025-03-12T12:00:00Z"
}
```

---

### GET `/api/v1/webhooks/{id}/deliveries`
Paginated delivery history.

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | — | Filter: `SUCCESS`, `FAILED` |
| `page` | int | `0` | Page number |
| `size` | int | `20` | Page size |

**Response** `200` — Paginated `WebhookDeliveryDto`
```json
{
  "content": [
    {
      "deliveryId": "uuid",
      "webhookId": "uuid",
      "eventName": "asset.created",
      "payload": "{...}",
      "statusCode": 200,
      "responseBody": "accepted",
      "responseTimeMs": 145,
      "attempts": 1,
      "status": "SUCCESS",
      "triggeredAt": "2025-03-12T08:00:00Z"
    }
  ],
  "totalElements": 145,
  "totalPages": 8,
  "size": 20,
  "number": 0
}
```

---

### GET `/api/v1/webhooks/{id}/deliveries/{deliveryId}`
Get a single delivery record.

**Response** `200` — `WebhookDeliveryDto`

---

## 24. Bulk Operations *(Phase 2)*

**Required Role:** `ROLE_ORG_ADMIN` / `ROLE_ADMIN`
**Base Path:** `/api/v1/bulk`

### POST `/api/v1/bulk/assets/import`
Bulk import assets from an Excel (`.xlsx`) file.

**Content-Type:** `multipart/form-data`

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `dryRun` | boolean | `false` | Validate without saving |

**Form Fields**

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | `.xlsx` spreadsheet |

**Response** `200`
```json
{
  "totalRows": 100,
  "imported": 97,
  "skipped": 3,
  "dryRun": false,
  "errors": [
    { "row": 5,  "message": "Duplicate asset tag: SRV-001" },
    { "row": 23, "message": "Invalid status: 'BROKEN'" },
    { "row": 67, "message": "Missing required field: name" }
  ]
}
```

---

### POST `/api/v1/bulk/assets/export`
Export all assets as a downloadable file.

**Request**
```json
{ "format": "EXCEL" }
```
> `format` values: `CSV`, `EXCEL`, `PDF`

**Response** `200`
- `Content-Disposition: attachment; filename="assets-export.xlsx"`
- Body: raw file bytes

---

### POST `/api/v1/bulk/purchase-orders/export`
Export all purchase orders.

**Request**
```json
{ "format": "EXCEL" }
```
> `format` values: `EXCEL`, `CSV`

**Response** `200` — file download

---

### POST `/api/v1/bulk/suppliers/export`
Export all suppliers.

**Request**
```json
{ "format": "CSV" }
```

**Response** `200` — file download

---

## 25. Health & Monitoring *(Phase 2)*

All health endpoints are **public** (no authentication required).

### GET `/api/v1/health`
Quick health check.

**Response** `200`
```json
{
  "status": "UP",
  "timestamp": "2025-03-12T12:00:00Z",
  "uptime": "5d 3h 42m 10s",
  "components": {
    "database": {
      "status": "UP",
      "responseTimeMs": 12
    },
    "jvm": {
      "heapUsedMb": 312,
      "heapMaxMb": 1024,
      "heapUtilizationPct": 30.5,
      "threadCount": 48
    }
  }
}
```

> `status` is `"UP"` when DB is reachable, `"DEGRADED"` otherwise.

---

### GET `/api/v1/health/detailed`
Extended health with database and JVM details.

**Response** `200`
```json
{
  "status": "UP",
  "timestamp": "2025-03-12T12:00:00Z",
  "uptime": "5d 3h 42m 10s",
  "version": "2.0.0",
  "components": {
    "database": {
      "status": "UP",
      "responseTimeMs": 12,
      "driverName": "PostgreSQL JDBC Driver",
      "driverVersion": "42.7.3",
      "databaseProductName": "PostgreSQL",
      "databaseProductVersion": "16.2",
      "url": "jdbc:postgresql://localhost:5432/eas_db"
    },
    "jvm": {
      "heapUsedMb": 312,
      "heapFreeMb": 400,
      "heapTotalMb": 712,
      "heapMaxMb": 1024,
      "heapUtilizationPct": 30.5,
      "availableProcessors": 8,
      "threadCount": 48,
      "javaVersion": "21.0.2",
      "javaVendor": "Homebrew",
      "osName": "Mac OS X",
      "osArch": "aarch64"
    }
  }
}
```

---

### GET `/api/v1/metrics`
JVM performance metrics.

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `day` | `day`, `week`, `month` |
| `metric` | string | — | Specific metric name |

**Response** `200`
```json
{
  "period": "day",
  "timestamp": "2025-03-12T12:00:00Z",
  "jvm": {
    "heapUsedMb": 312,
    "heapTotalMb": 712,
    "heapMaxMb": 1024,
    "heapUtilizationPct": 30.5,
    "availableProcessors": 8,
    "threadCount": 48
  },
  "uptime": "5d 3h 42m 10s",
  "uptimeMs": 463330000
}
```

---

### GET `/api/v1/metrics/database`
Database connection health and metadata.

**Response** `200`
```json
{
  "status": "UP",
  "responseTimeMs": 12,
  "driverName": "PostgreSQL JDBC Driver",
  "driverVersion": "42.7.3",
  "databaseProductName": "PostgreSQL",
  "databaseProductVersion": "16.2",
  "url": "jdbc:postgresql://localhost:5432/eas_db"
}
```

---

### GET `/api/v1/metrics/endpoints`
Per-endpoint metrics (requires Micrometer integration).

**Response** `200`
```json
{
  "timestamp": "2025-03-12T12:00:00Z",
  "note": "Per-endpoint metrics require Micrometer/Actuator integration."
}
```

---

### GET `/api/v1/metrics/throughput`

**Query Parameters**

| Param | Type | Default |
|-------|------|---------|
| `hours` | int | `24` |

**Response** `200`
```json
{
  "timestamp": "2025-03-12T12:00:00Z",
  "uptimeMs": 463330000,
  "note": "Detailed throughput metrics require Micrometer integration."
}
```

---

### GET `/api/v1/metrics/errors`
**Response** `200`
```json
{
  "timestamp": "2025-03-12T12:00:00Z",
  "note": "Error metrics require Micrometer integration."
}
```

---

## 26. IT Asset Discovery *(Phase 3)*

**Required Role:** `ROLE_ORG_ADMIN` / `ROLE_ADMIN`
**Base Path:** `/api/v1/discovery`

Discover network devices via ping sweep and port scanning, then promote them to managed assets.

### DiscoveredDevice Object
```json
{
  "id": "uuid",
  "ipAddress": "192.168.1.105",
  "hostname": "finance-pc-01.local",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "deviceType": "Windows Workstation/Server",
  "openPorts": [80, 443, 3389],
  "discoveryMethod": "PORT_SCAN",
  "status": "ONLINE",
  "osHint": null,
  "responseTimeMs": 14,
  "lastSeenAt": "2025-03-12T12:00:00Z",
  "promotedAssetId": null,
  "createdAt": "2025-03-12T12:00:00Z"
}
```

**Device type inference from open ports:**

| Open Port(s) | Inferred Type |
|--------------|---------------|
| `3389` | Windows Workstation/Server |
| `22` + `80` | Linux Server |
| `3306` or `5432` or `27017` | Database Server |
| `80` or `443` | Web Server |
| `22` only | Linux Device |
| Other | Network Device |

---

### POST `/api/v1/discovery/scan`
Trigger a network scan (ping sweep + optional port scan). Runs concurrently (up to 50 parallel probes). Results are upserted — re-scanning the same IP updates the existing record.

**Request**
```json
{
  "cidrRange": "192.168.1.0/24",
  "ipAddresses": null,
  "portScan": true,
  "ports": [22, 80, 443, 445, 3389, 8080, 8443, 3306, 5432, 27017],
  "timeoutMs": 1000
}
```

> Use either `cidrRange` (e.g. `"192.168.1.0/24"`, minimum `/16`) **or** an explicit `ipAddresses` list. `ports` defaults to the 10 common ports above if omitted.

**Response** `200` — `Array<DiscoveredDeviceObject>`
```json
[
  {
    "id": "uuid",
    "ipAddress": "192.168.1.105",
    "hostname": "finance-pc-01.local",
    "deviceType": "Windows Workstation/Server",
    "openPorts": [80, 3389],
    "discoveryMethod": "PORT_SCAN",
    "status": "ONLINE",
    "responseTimeMs": 14,
    "lastSeenAt": "2025-03-12T12:00:00Z",
    "createdAt": "2025-03-12T12:00:00Z"
  }
]
```

---

### GET `/api/v1/discovery/devices`
Paginated list of all discovered devices, sorted by `lastSeenAt` descending.

**Query Parameters**

| Param | Type | Default |
|-------|------|---------|
| `page` | int | `0` |
| `size` | int | `20` |

**Response** `200` — Paginated `DiscoveredDeviceDto`
```json
{
  "content": [ /* DiscoveredDevice Objects */ ],
  "totalElements": 42,
  "totalPages": 3,
  "size": 20,
  "number": 0
}
```

---

### GET `/api/v1/discovery/devices/{id}`
**Response** `200` — DiscoveredDevice Object

---

### POST `/api/v1/discovery/devices/{id}/promote`
Promote a discovered device into a managed Asset. Automatically sets device status to `PROMOTED`.

> Throws `409` if device is already promoted.

**Response** `200`
```json
{
  "assetId": "uuid",
  "assetName": "finance-pc-01.local",
  "deviceId": "uuid"
}
```

---

### DELETE `/api/v1/discovery/devices/{id}`
Soft-delete a discovered device record.

**Response** `204`

---

### GET `/api/v1/discovery/summary`
Quick stats for the discovery dashboard.

**Response** `200`
```json
{
  "total": 42,
  "online": 38,
  "offline": 3,
  "promoted": 1
}
```

---

## 27. Cloud Assets *(Phase 3)*

**Base Path:** `/api/v1/cloud-assets`
**Required Role:** `ROLE_ORG_ADMIN` / `ROLE_ADMIN` (write), any authenticated (read)

Track cloud resources across AWS, Azure, GCP and other providers with cost monitoring.

### CloudAsset Object
```json
{
  "id": "uuid",
  "name": "prod-web-server-01",
  "provider": "AWS",
  "region": "us-east-1",
  "resourceId": "arn:aws:ec2:us-east-1:123456789012:instance/i-0abc123def456",
  "resourceType": "VIRTUAL_MACHINE",
  "status": "RUNNING",
  "accountId": "123456789012",
  "monthlyCostEstimate": 95.50,
  "currency": "USD",
  "environment": "PROD",
  "tags": "{\"Team\":\"Backend\",\"Project\":\"WebApp\"}",
  "description": "Primary web application server",
  "lastSyncAt": "2025-03-12T12:00:00Z",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-03-12T12:00:00Z"
}
```

---

### POST `/api/v1/cloud-assets`
Register a new cloud asset.

**Request** — CloudAsset Object fields (omit `id`, `lastSyncAt`, `createdAt`, `updatedAt`)

**Response** `201` — CloudAsset Object

---

### GET `/api/v1/cloud-assets`
List cloud assets with optional filters.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `provider` | CloudProvider | Filter by cloud provider |
| `environment` | string | Filter by environment (`DEV`, `STAGING`, `PROD`) |
| `page` | int | Page number (default `0`) |
| `size` | int | Page size (default `20`) |

**Response** `200` — Paginated `CloudAssetDto`
```json
{
  "content": [ /* CloudAsset Objects */ ],
  "totalElements": 15,
  "totalPages": 1,
  "size": 20,
  "number": 0
}
```

---

### GET `/api/v1/cloud-assets/{id}`
**Response** `200` — CloudAsset Object

---

### PUT `/api/v1/cloud-assets/{id}`
Full update of a cloud asset.

**Response** `200` — updated CloudAsset Object

---

### DELETE `/api/v1/cloud-assets/{id}`
**Response** `204`

---

### GET `/api/v1/cloud-assets/cost-summary`
Monthly cost breakdown across all cloud assets.

**Response** `200`
```json
{
  "totalMonthlyCost": 2840.50,
  "currency": "USD",
  "costByProvider": {
    "AWS": 1950.00,
    "AZURE": 650.00,
    "GCP": 240.50
  },
  "costByEnvironment": {
    "PROD": 2100.00,
    "STAGING": 490.00,
    "DEV": 250.50
  },
  "topAssets": [
    {
      "assetName": "prod-web-cluster",
      "resourceType": "KUBERNETES_CLUSTER",
      "monthlyCost": 850.00
    },
    {
      "assetName": "prod-db-primary",
      "resourceType": "DATABASE",
      "monthlyCost": 420.00
    }
  ]
}
```

---

### POST `/api/v1/cloud-assets/{id}/cost`
Record an actual monthly cost entry for a cloud asset.

**Request**
```json
{
  "billingMonth": "2025-02",
  "amount": 97.32,
  "serviceName": "EC2 Compute"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `billingMonth` | string | Yes | Format: `YYYY-MM` |
| `amount` | decimal | Yes | Cost amount |
| `serviceName` | string | No | Sub-service label |

**Response** `204 No Content`

---

## 28. AI / Predictive Intelligence *(Phase 3)*

**Base Path:** `/api/v1/ai`
**Required Role:** `ROLE_ORG_ADMIN` / `ROLE_ADMIN` (generate), any authenticated (read/resolve)

Rule-based predictive engine that analyses all assets and surfaces actionable insights.

### PredictiveInsight Object
```json
{
  "id": "uuid",
  "assetId": "uuid",
  "assetName": "HP ProLiant Server (Legacy)",
  "assetTag": "SRV-LEGACY-001",
  "insightType": "WARRANTY_EXPIRY",
  "severity": "MEDIUM",
  "title": "Warranty expiring in 20 days",
  "description": "The warranty for 'HP ProLiant Server (Legacy)' expires on 2026-04-01. Consider renewal or replacement planning.",
  "confidence": 0.99,
  "predictedDate": "2026-04-01",
  "resolved": false,
  "resolvedAt": null,
  "createdAt": "2025-03-12T12:00:00Z"
}
```

### Detection Rules

| InsightType | Trigger Condition | Confidence |
|-------------|-------------------|------------|
| `MAINTENANCE_DUE` | `nextDueDate` within 30 days or overdue | 90% |
| `FAILURE_RISK` | 3+ maintenance events in 90 days, or condition `DAMAGED`/`SCRAP` | 60–95% |
| `WARRANTY_EXPIRY` | `warrantyExpiryDate` within 60 days | 99% |
| `ASSET_AGING` | Asset has consumed >80% of `usefulLifeMonths` | 85% |
| `DEPRECIATION_COMPLETE` | `currentBookValue` ≤ `residualValue` but status is `IN_USE` | 99% |
| `UNDERUTILIZED` | Status `IN_STOCK`/`RETIRED` for >180 days with `purchaseCost` > $1,000 | 80% |

---

### POST `/api/v1/ai/insights/generate`
Re-analyse all assets in the current tenant and refresh insights. Existing unresolved insights of the same type per asset are replaced with the latest analysis.

**Response** `200` — `Array<PredictiveInsightDto>`
```json
[
  {
    "id": "uuid",
    "assetId": "uuid",
    "assetName": "HP ProLiant Server (Legacy)",
    "assetTag": "SRV-LEGACY-001",
    "insightType": "FAILURE_RISK",
    "severity": "CRITICAL",
    "title": "Elevated failure risk detected",
    "description": "Asset had 0 maintenance events in the past 90 days and is in DAMAGED condition. High frequency indicates potential hardware failure.",
    "confidence": 0.80,
    "predictedDate": "2025-04-11",
    "resolved": false,
    "resolvedAt": null,
    "createdAt": "2025-03-12T12:00:00Z"
  }
]
```

---

### GET `/api/v1/ai/insights`
List insights with optional filters.

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | InsightType | — | Filter by insight type |
| `severity` | InsightSeverity | — | Filter by severity |
| `unresolvedOnly` | boolean | `true` | Show only unresolved |

**Response** `200` — `Array<PredictiveInsightDto>`

---

### GET `/api/v1/ai/insights/{id}`
**Response** `200` — PredictiveInsight Object

---

### POST `/api/v1/ai/insights/{id}/resolve`
Mark an insight as resolved (acknowledged / action taken).

**Response** `204 No Content`

---

### GET `/api/v1/ai/insights/summary`
Dashboard summary of all unresolved insights.

**Response** `200`
```json
{
  "totalUnresolved": 12,
  "bySeverity": {
    "CRITICAL": 2,
    "HIGH": 4,
    "MEDIUM": 5,
    "LOW": 1
  }
}
```

---



---

## 29. Categories

**Base Path:** `/api/v1/categories`

All category endpoints follow the standard CRUD pattern:
- `GET /` — list all categories
- `POST /` — create category
- `GET /{id}` — get category by ID
- `PUT /{id}` / `PATCH /{id}` — update category
- `DELETE /{id}` — soft-delete category
- `GET /{parentId}/sub-categories` — get child categories

---

## 30. System Config

**Required Role:** `ROLE_ADMIN` / `ROLE_ORG_ADMIN`

The following base paths define and structure the tenant workspace and follow the standard CRUD patterns (`GET`, `POST`, `GET /{id}`, `PUT /{id}`, `PATCH /{id}`, `DELETE /{id}`):

- **Departments:** `/api/v1/departments`
- **Locations:** `/api/v1/locations` (plus `GET /{parentId}/sub-locations`)
- **Roles:** `/api/v1/roles` (plus `GET /permissions`, `GET /by-name`)
- **Users:** `/api/v1/users` (plus `GET /me`, `PUT /{id}/deactivate`, `PUT /{id}/role`)
- **Organisations:** `/api/v1/organisations` (plus `PUT /{orgId}/storage-config`)

---

## 31. Asset Checkouts

**Base Path:** `/api/v1/checkouts`

For tracking physical chain-of-custody for assets assigned to users:
- `GET /` — list all checkout events
- `GET /{id}` — get by ID
- `GET /assets/{assetId}` — get checkouts by asset
- `GET /users/{userId}` — get checkouts by user
- `GET /overdue` — list overdue returns
- `POST /assets/{assetId}/users/{userId}` — execute a new checkout
- `POST /{id}/checkin` — return the asset (checkin)

---

## 32. Expenses

**Base Path:** `/api/v1/expenses`

Tracking incidental costs, maintenance parts, or ad-hoc purchasing.
- `GET /` — list expenses
- `POST /` — submit expense
- `GET /{id}` — get expense by ID
- `DELETE /{id}` — cancel expense
- `GET /pending` — list pending expenses
- `GET /users/{userId}` — list expenses by user
- `POST /{id}/approve` — approve expense
- `POST /{id}/reject` — reject expense

---

## 33. Lease Records

**Base Path:** `/api/v1/leases`

For assets procured under Operational/Capital leases instead of direct purchase.
- `GET /`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` — Standard CRUD
- `GET /assets/{assetId}` — get lease for specific asset
- `GET /expiring-soon` — get leases expiring within 90 days
- `POST /{id}/terminate` — early termination of a lease

---

## 34. Exchange Rates

**Base Path:** `/api/v1/exchange-rates`

- `GET /`, `POST /`, `GET /{id}`, `DELETE /{id}` — Standard CRUD for rate pairs.
- `GET /convert?from=USD&to=EUR&amount=100` — Convert a nominal value.

---

## 35. Data Privacy

**Base Path:** `/api/v1/dpa`

Consent and Subject Access Request (DSAR) compliance modules.
- `GET /consent` / `POST /consent` — handle user privacy consent
- `GET /consent/check` — verify active consent
- `DELETE /consent/{purpose}` — withdraw consent
- `GET /dsar`, `POST /dsar`, `GET /dsar/{id}` — Create and view subject requests
- `PATCH /dsar/{id}/status` — Update processing status of a subject request

## Appendix — Common Headers

| Header | Where Required | Example |
|--------|---------------|---------|
| `Authorization` | All authenticated endpoints | `Bearer eyJhbGci...` |
| `X-Organisation-Id` | All tenant-scoped endpoints | `0fd33fdf-63ee-4b62-a331-6c43322a2cb0` |
| `Content-Type` | POST / PUT / PATCH | `application/json` |
| `X-Request-ID` | Returned by server | Response tracking |
| `x-paystack-signature` | Paystack webhook receiver | `sha512_hmac_sig` |

## Appendix — Pagination

Paginated endpoints return:
```json
{
  "content": [],
  "totalElements": 100,
  "totalPages": 5,
  "size": 20,
  "number": 0,
  "first": true,
  "last": false
}
```

Standard query params: `?page=0&size=20&sort=createdAt,desc`

## Appendix — Rate Limiting

- **Limit:** 100 requests/minute, 5,000 requests/hour per IP
- **Header returned:** `X-RateLimit-Remaining`
- **429 Too Many Requests** when exceeded
