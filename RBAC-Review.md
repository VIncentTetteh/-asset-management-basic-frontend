# Roles & Permissions — Architecture Review & Proposals

**Scope:** Enterprise-Asset-Manager (Spring Boot), Enterprise-Asset-manager-Frontend (Next.js), Enterprise-Asset-manager-desktop-app (Electron/React)  
**Reviewed by:** Senior Engineer (AI-assisted)  
**Date:** April 2026

---

## Executive Summary

The overall RBAC design is solid for an early-stage enterprise product. The live-permission cache, JWT blacklist, and `@PreAuthorize` method guards are the right building blocks. However, there are **9 significant issues** across the stack — some are security risks (localStorage token storage, client-side-only route protection), some are correctness bugs (dual permission formats, fragile admin detection), and some are maintainability time bombs (full cache eviction, duplicated auth utilities, no `<Can>` component). Each issue is called out below with a concrete fix.

---

## SECTION 1 — Backend Issues (Spring Boot)

---

### Issue B-1 · CRITICAL · Dual Permission Storage Format

**What's happening:**  
Permissions are stored in the DB as either a JSON array `["VIEW_ASSETS","EDIT_ASSET"]` or a JSON object `{"VIEW_ASSETS":true,"EDIT_ASSET":true}` depending on which client created the role. The backend then branches on the first character to decide which format to parse.

```java
// PermissionCacheService.java
static List<String> parsePermissions(Role role) {
    String raw = role.getPermissions();
    if (raw.startsWith("[")) {
        // array format
    } else if (raw.startsWith("{")) {
        // object format — sent by the Next.js frontend
    }
}
```

**Why this is a problem:**  
- Data integrity is broken. The same conceptual value lives in two formats.
- Any new consumer has to duplicate this branching logic.
- A bug introduced in one path silently hides permissions.

**Fix — store permissions as a proper JOIN table, not JSON:**

```java
// New entity
@Entity
@Table(name = "role_permission",
    uniqueConstraints = @UniqueConstraint(columnNames = {"role_id", "permission"}))
public class RolePermission {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 80)
    private Permission permission;
}

// Updated Role entity
@Entity
@Table(name = "role")
public class Role extends BaseEntity {
    private String name;
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private Organisation organisation;

    @OneToMany(mappedBy = "role", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private Set<RolePermission> rolePermissions = new HashSet<>();

    // Helper
    public Set<Permission> getPermissions() {
        return rolePermissions.stream()
            .map(RolePermission::getPermission)
            .collect(Collectors.toSet());
    }
}
```

**Frontend change:** Send permissions as a plain array `["VIEW_ASSETS", "EDIT_ASSET"]` — no more object format. Kill the `normalizeRole()` function in `roleService.ts` once the backend is normalized.

---

### Issue B-2 · HIGH · Fragile Admin Detection by Role Name String

**What's happening:**  
Admin status is inferred by checking whether the role name ends with `_ADMIN`:

```java
// RolePermissionDefaults.java
public static boolean isAdminRoleName(String roleName) {
    String normalized = roleName.trim().toUpperCase();
    return "ADMIN".equals(normalized) || normalized.endsWith("_ADMIN");
}
```

**Why this is a problem:**  
- A role named `DEPT_ADMIN` for a limited department admin would accidentally get all 65+ permissions.
- String matching on role names is a security anti-pattern. Any typo or naming change silently changes the security boundary.

**Fix — add an explicit `isSystemRole` / `isAdmin` flag to the Role entity:**

```java
@Entity
@Table(name = "role")
public class Role extends BaseEntity {
    private String name;
    private String description;
    private boolean systemRole = false;   // Cannot be deleted/modified by org admins
    private boolean grantAllPermissions = false;  // Only set by SYSTEM_ADMIN at org creation

    @ManyToOne(fetch = FetchType.LAZY)
    private Organisation organisation;
}
```

```java
// RoleService — on org creation, bootstrap a real admin role
public Role createOrgAdminRole(Organisation org) {
    Role adminRole = new Role();
    adminRole.setName("Administrator");
    adminRole.setOrganisation(org);
    adminRole.setSystemRole(true);
    adminRole.setGrantAllPermissions(true);
    return roleRepository.save(adminRole);
}
```

```java
// PermissionCacheService — simplified, no string matching
public List<String> getPermissionsForUser(String email, String organisationId) {
    return userRepository
        .findByEmailAndOrganisationId(email, UUID.fromString(organisationId))
        .map(user -> {
            Role role = user.getRole();
            if (role.isGrantAllPermissions()) {
                return Arrays.stream(Permission.values()).map(Enum::name).collect(toList());
            }
            return role.getPermissions().stream().map(Permission::name).collect(toList());
        })
        .orElse(Collections.emptyList());
}
```

---

### Issue B-3 · HIGH · Full Cache Eviction on Any Role Update

**What's happening:**  
When any role's permissions change, the entire permission cache is wiped using `allEntries = true`:

```java
@CacheEvict(value = CACHE_NAME, allEntries = true)
public void evictForRole(UUID roleId) { }
```

**Why this is a problem:**  
- In an org with 500 users across 20 roles, changing one role causes 500 cache misses on the next request cycle, all hitting the database simultaneously. This is a thundering herd problem.

**Fix — targeted eviction keyed on `roleId`, not `email#orgId`:**

Change the cache key strategy so you can evict by role, not by user:

```java
// Two cache levels:
// 1. role -> permissions: evict only the changed role
// 2. user -> roleId: lightweight lookup

@Cacheable(value = "role-permissions", key = "#roleId")
public List<String> getPermissionsForRole(UUID roleId) {
    return roleRepository.findById(roleId)
        .map(role -> role.getPermissions().stream().map(Permission::name).collect(toList()))
        .orElse(Collections.emptyList());
}

@CacheEvict(value = "role-permissions", key = "#roleId")
public void evictForRole(UUID roleId) {
    log.info("[CACHE] Evicted permissions for role {}", roleId);
}

// In JwtAuthenticationFilter — look up user's roleId, then hit role cache
public List<String> getPermissionsForUser(String email, String organisationId) {
    UUID roleId = userRepository
        .findRoleIdByEmailAndOrganisationId(email, UUID.fromString(organisationId))
        .orElse(null);
    if (roleId == null) return Collections.emptyList();
    return getPermissionsForRole(roleId);
}
```

Now a role update evicts exactly one cache key. All users of that role get fresh permissions on next request. Unaffected roles stay cached.

---

### Issue B-4 · MEDIUM · `requireSameOrganisation` is a Manual, Forgettable Check

**What's happening:**  
Tenant validation is done by manually calling a static helper at the top of sensitive controller methods:

```java
@PostMapping
@PreAuthorize("hasAnyAuthority('MANAGE_ROLES')")
public ResponseEntity<RoleDto> createRole(..., @RequestParam UUID organisationId) {
    requireSameOrganisation(organisationId);   // <-- Easy to forget
    return ResponseEntity.status(CREATED).body(roleService.createRole(roleDto, organisationId));
}
```

**Why this is a problem:**  
Any endpoint where a developer forgets this call becomes a cross-tenant data leak. This has already happened in at least one endpoint pattern.

**Fix — enforce tenant context in a Spring AOP aspect so it is never skippable:**

```java
// Annotation
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface EnforceTenant {
    /** The name of the @RequestParam / @PathVariable that holds the organisationId */
    String param() default "organisationId";
}

// Aspect
@Aspect
@Component
@RequiredArgsConstructor
public class TenantEnforcementAspect {

    @Around("@annotation(enforceTenant)")
    public Object enforce(ProceedingJoinPoint pjp, EnforceTenant enforceTenant) throws Throwable {
        // Reflect on method parameters to find the organisationId value
        UUID requestedOrgId = extractOrgIdFromArgs(pjp, enforceTenant.param());
        UUID currentOrgId = TenantContext.getOrganisationId();

        if (!currentOrgId.equals(requestedOrgId)) {
            throw new AccessDeniedException("Cross-tenant access denied");
        }
        return pjp.proceed();
    }
}

// Usage — clean, declarative, impossible to forget
@PostMapping
@PreAuthorize("hasAnyAuthority('MANAGE_ROLES')")
@EnforceTenant
public ResponseEntity<RoleDto> createRole(@Valid @RequestBody RoleDto roleDto,
                                          @RequestParam UUID organisationId) {
    return ResponseEntity.status(CREATED).body(roleService.createRole(roleDto, organisationId));
}
```

---

### Issue B-5 · MEDIUM · Single Role Per User (No Role Composition)

**What's happening:**  
```java
// User.java
@ManyToOne(fetch = FetchType.LAZY)
private Role role;   // One role only
```

**Why this is a problem:**  
Real enterprise orgs regularly need a user to hold two roles — e.g., a "Finance Manager" who also has "Auditor" read-only access. Today this requires creating a combined role manually, leading to role explosion.

**Fix — Many-to-many user↔role, resolve permissions as a union:**

```java
// User.java
@ManyToMany(fetch = FetchType.LAZY)
@JoinTable(name = "user_roles",
    joinColumns = @JoinColumn(name = "user_id"),
    inverseJoinColumns = @JoinColumn(name = "role_id"))
private Set<Role> roles = new HashSet<>();
```

```java
// PermissionCacheService — union of all assigned roles' permissions
public List<String> getPermissionsForUser(String email, String organisationId) {
    return userRepository
        .findByEmailAndOrganisationId(email, UUID.fromString(organisationId))
        .map(user -> user.getRoles().stream()
            .flatMap(role -> role.getPermissions().stream())
            .map(Permission::name)
            .distinct()
            .collect(toList()))
        .orElse(Collections.emptyList());
}
```

> **Note:** Keep a "primary role" concept (e.g., `primaryRoleId`) for display purposes (the user's job title role). Additional roles are additive permission grants only.

---

### Issue B-6 · LOW · Stale Permissions in JWT Claims

**What's happening:**  
The JWT is generated with a `permissions` claim:

```java
// Claims include permissions array at login time
claims.put("permissions", permissions);
```

But the JwtAuthenticationFilter loads live permissions from cache and ignores the JWT permissions claim. This means the JWT carries a stale `permissions` array that serves no purpose and wastes token size.

**Fix — remove `permissions` from the JWT entirely:**

```java
// JwtUtil — cleaner claims
Map<String, Object> claims = new HashMap<>();
claims.put("role", user.getPrimaryRoleName());
claims.put("organisationId", user.getOrganisation().getId().toString());
// Do NOT include permissions — they are loaded live from cache
return generateToken(user.getEmail(), claims, expirationMillis);
```

The live cache is the source of truth. The JWT only needs to carry identity (`sub`), tenant context (`organisationId`), and the token identifier (`jti`) for blacklisting.

---

## SECTION 2 — Frontend Issues (Next.js + Electron)

---

### Issue F-1 · CRITICAL · Token Stored in `localStorage` (XSS Vulnerable)

**What's happening:**  
Both the Next.js and Electron apps store the JWT in `localStorage`:

```typescript
// authContext.ts
localStorage.getItem("token")
localStorage.setItem("user", JSON.stringify(user))
```

**Why this is a problem:**  
Any XSS vulnerability in the app (or a third-party script) can read `localStorage` and steal the token. For an enterprise asset manager with financial data, this is unacceptable.

**Fix — use `HttpOnly` cookies for the JWT:**

```typescript
// The backend sets the token as an HttpOnly cookie on login response:
// Set-Cookie: access_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/api

// authService.ts — no token handling needed on the client
export const authService = {
    login: async (data: LoginRequest): Promise<LoginResponse> => {
        // Credentials-mode causes the browser to store the HttpOnly cookie automatically
        const response = await api.post<LoginResponse>("/auth/login", data, {
            withCredentials: true,
        });
        // Store only non-sensitive user metadata (name, role display) in memory/context
        return response.data;
    },

    logout: async () => {
        await api.post("/auth/logout", {}, { withCredentials: true });
        // Backend clears the cookie via Set-Cookie: access_token=; Max-Age=0
    },
};
```

```typescript
// All API calls include withCredentials so the HttpOnly cookie is sent automatically
const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,   // ← This is the key
});
```

The user object (name, role name, orgId) can still live in a React context or `sessionStorage` — only the JWT itself must be inaccessible to JavaScript.

---

### Issue F-2 · CRITICAL · ProtectedRoute Only Checks Token Existence — No Permission-Based UI Guard

**What's happening:**  

```typescript
// ProtectedRoute.tsx
const checkAuth = () => {
    const token = localStorage.getItem("token");
    if (!token) {
        router.push("/login");
    } else {
        setIsAuthorized(true);  // ← Any token = full access to every page
    }
};
```

A logged-in warehouse clerk can navigate directly to `/roles`, `/settings`, or `/admin` and see the UI. The backend will block the API calls, but the user still reaches pages they shouldn't see, which is a poor UX and a potential information disclosure.

**Fix — a permission-aware auth context + `<Can>` component:**

```typescript
// 1. AuthContext — holds the decoded user + their permissions
interface AuthContextValue {
    user: AuthUser | null;
    permissions: Set<Permission>;
    hasPermission: (permission: Permission) => boolean;
    hasAnyPermission: (...permissions: Permission[]) => boolean;
    hasAllPermissions: (...permissions: Permission[]) => boolean;
    isAuthenticated: boolean;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [permissions, setPermissions] = useState<Set<Permission>>(new Set());

    // On mount, fetch /auth/profile — this is the single source of truth
    useEffect(() => {
        authService.getProfile()
            .then(profile => {
                setUser(profile);
                setPermissions(new Set(profile.permissions as Permission[]));
            })
            .catch(() => {
                setUser(null);
                setPermissions(new Set());
            });
    }, []);

    const hasPermission = (permission: Permission) => permissions.has(permission);
    const hasAnyPermission = (...perms: Permission[]) => perms.some(p => permissions.has(p));
    const hasAllPermissions = (...perms: Permission[]) => perms.every(p => permissions.has(p));

    return (
        <AuthContext.Provider value={{
            user, permissions,
            hasPermission, hasAnyPermission, hasAllPermissions,
            isAuthenticated: user !== null,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
```

```typescript
// 2. <Can> component — declarative permission checks in JSX
interface CanProps {
    do: Permission | Permission[];
    any?: boolean;   // default: ALL required
    fallback?: ReactNode;
    children: ReactNode;
}

export const Can = ({ do: perms, any = false, fallback = null, children }: CanProps) => {
    const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
    const permArray = Array.isArray(perms) ? perms : [perms];

    const allowed = any
        ? hasAnyPermission(...permArray)
        : hasAllPermissions(...permArray);

    return allowed ? <>{children}</> : <>{fallback}</>;
};

// Usage in any component
<Can do="CREATE_ASSET" fallback={<p>No access</p>}>
    <CreateAssetButton />
</Can>

<Can do={["MANAGE_USERS", "VIEW_USERS"]} any>
    <UsersMenu />
</Can>
```

```typescript
// 3. Route-level guard using the same context
// middleware.ts (Next.js App Router)
export function middleware(request: NextRequest) {
    const token = request.cookies.get("access_token");  // HttpOnly cookie
    if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
}

// For page-level permission checks, use a HOC or layout component:
// app/roles/layout.tsx
export default function RolesLayout({ children }: { children: ReactNode }) {
    const { hasAnyPermission, isAuthenticated } = useAuth();
    const router = useRouter();

    if (!isAuthenticated) { router.push("/login"); return null; }
    if (!hasAnyPermission("MANAGE_ROLES", "VIEW_ROLES", "SYSTEM_ADMIN")) {
        return <Forbidden />;
    }
    return <>{children}</>;
}
```

---

### Issue F-3 · HIGH · Frontend `Permission` Type is Incomplete and Diverges from Backend

**What's happening:**  

```typescript
// types/index.ts — only 16 permissions listed
export type Permission =
    | "VIEW_ASSETS" | "CREATE_ASSETS" | "UPDATE_ASSETS" | "DELETE_ASSETS"
    | "VIEW_USERS" | "CREATE_USERS" | "UPDATE_USERS" | "DELETE_USERS"
    ...
```

The backend has 65+ permissions. The frontend type only covers 16, with different naming (`CREATE_ASSETS` vs. `CREATE_ASSET`). This means TypeScript provides no safety for the majority of permissions.

**Fix — auto-generate the `Permission` type from the backend:**

```java
// Backend: add a type-generation endpoint (dev/build only)
@GetMapping("/roles/permissions")
@PreAuthorize("permitAll()")  // or restrict to internal
public ResponseEntity<List<String>> getAvailablePermissions() {
    return ResponseEntity.ok(Arrays.stream(Permission.values()).map(Enum::name).collect(toList()));
}
```

```typescript
// scripts/generate-permissions.ts — run at build time
import fs from "fs";

async function generatePermissions() {
    const res = await fetch(`${process.env.API_URL}/api/v1/roles/permissions`);
    const permissions: string[] = await res.json();

    const type = `// Auto-generated from backend Permission enum. Do not edit manually.\n` +
        `export type Permission =\n` +
        permissions.map(p => `    | "${p}"`).join("\n") + ";\n";

    fs.writeFileSync("src/types/permissions.generated.ts", type);
    console.log(`Generated ${permissions.length} permissions.`);
}

generatePermissions();
```

```json
// package.json
{
  "scripts": {
    "generate:permissions": "ts-node scripts/generate-permissions.ts",
    "prebuild": "npm run generate:permissions"
  }
}
```

This ensures the frontend `Permission` type is always in sync with the backend at build time.

---

### Issue F-4 · HIGH · Auth Utilities Duplicated in Frontend and Desktop App

**What's happening:**  
Both `Enterprise-Asset-manager-Frontend/src/lib/authContext.ts` and `Enterprise-Asset-manager-desktop-app/renderer/src/lib/authContext.ts` contain near-identical logic for extracting the `organisationId` from localStorage and decoding the JWT payload — including the same manual base64 decode of the JWT.

**Why this is a problem:**  
A bug fixed in one is not fixed in the other. This has already happened — the desktop app's `decodeJwtPayload` handles base64url padding manually while the frontend uses a slightly different approach.

**Fix — extract to a shared package:**

```
packages/
  auth-utils/
    src/
      decodeJwt.ts
      getOrganisationId.ts
      authStorage.ts
      permissions.ts
    package.json   { "name": "@assetiq/auth-utils" }
```

```typescript
// packages/auth-utils/src/decodeJwt.ts
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const [, payload] = token.split(".");
        const padded = payload.replace(/-/g, "+").replace(/_/g, "/")
            .padEnd(payload.length + ((4 - payload.length % 4) % 4), "=");
        return JSON.parse(atob(padded));
    } catch {
        return null;
    }
}
```

Both apps install `@assetiq/auth-utils` from the monorepo. One fix, two consumers.

---

### Issue F-5 · MEDIUM · `normalizeRole` Should Not Exist on the Frontend

**What's happening:**  

```typescript
// roleService.ts — frontend normalizing backend data inconsistency
const normalizeRole = (role: Role): Role => {
    if (Array.isArray(role.permissions)) return role;
    if (typeof role.permissions === "string") {
        const parsed = JSON.parse(role.permissions);
        if (Array.isArray(parsed)) { ... }
        if (typeof parsed === "object") { ... }
    }
    return { ...role, permissions: [] };
};
```

The frontend is compensating for the dual-format storage bug (Issue B-1). Fix B-1 and this function disappears entirely. The API contract should guarantee that `permissions` is always `string[]`.

---

## SECTION 3 — Proposed Target Architecture

### 3.1 Backend Authorization Stack

```
HTTP Request
    │
    ▼
JwtAuthenticationFilter
    │  Validates signature, checks blacklist
    │  Sets SecurityContext with:
    │    - SimpleGrantedAuthority("ROLE_<roleName>")
    │    - SimpleGrantedAuthority("<PERMISSION_NAME>") × N  (from role cache)
    │
    ▼
TenantFilter
    │  Sets TenantContext.organisationId from JWT claim
    │
    ▼
@EnforceTenant AOP Aspect  ← NEW: automatic, not manual
    │  Validates @RequestParam organisationId == TenantContext
    │
    ▼
@PreAuthorize("hasAuthority('CREATE_ASSET')")  ← Controller
    │
    ▼
Service Layer
```

### 3.2 Permission Cache Architecture

```
User request arrives
    │
    ├─ JwtFilter extracts email + organisationId
    │
    ▼
PermissionCacheService.getPermissionsForUser(email, orgId)
    │
    ├─ Cache hit on "user-role:<email>:<orgId>" → roleId
    │   └─ Cache hit on "role-perms:<roleId>" → permissions ✓
    │
    └─ Cache miss → DB query
           └─ Write "user-role" key (TTL: 24h)
           └─ Write "role-perms" key (TTL: 1h)
           └─ Return permissions

Role update → evict only "role-perms:<roleId>"  ✓  (not all entries)
User role change → evict "user-role:<email>:<orgId>"  ✓
```

### 3.3 Frontend Authorization Stack

```
Browser
    │
    ├── AuthProvider (React Context)
    │     - Fetches /auth/profile on mount
    │     - Stores: user, permissions Set<Permission>
    │     - Exposes: hasPermission(), hasAnyPermission()
    │
    ├── Next.js Middleware (Edge)
    │     - Checks HttpOnly cookie presence
    │     - Redirects unauthenticated users to /login
    │
    ├── Layout Components (per route group)
    │     - useAuth().hasAnyPermission("MANAGE_ROLES") → <Forbidden /> or children
    │
    └── <Can do="CREATE_ASSET"> component
          - Inline permission checks in UI
          - Optional fallback prop for disabled states
```

---

## SECTION 4 — Prioritized Action Plan

| Priority | Issue | Effort | Risk if Ignored |
|----------|-------|--------|-----------------|
| 🔴 Critical | F-1: Token in localStorage | Medium | Token theft via XSS |
| 🔴 Critical | F-2: No permission-based route guard | Medium | Unauthorized page access |
| 🔴 Critical | B-2: Admin by name string matching | Low | Privilege escalation |
| 🟠 High | B-1: Dual permission formats | High | Data corruption, hidden bugs |
| 🟠 High | F-3: Permission type mismatch | Low | Silent type errors at runtime |
| 🟠 High | F-4: Duplicated auth utilities | Low | Divergent bug fixes |
| 🟡 Medium | B-3: Full cache eviction | Medium | DB thundering herd at scale |
| 🟡 Medium | B-4: Manual tenant check | Medium | Cross-tenant data leak |
| 🟡 Medium | B-5: Single role per user | High | Role explosion / rigidity |
| 🟢 Low | B-6: Stale permissions in JWT | Low | Wasted token bandwidth |
| 🟢 Low | F-5: normalizeRole on frontend | Low | Resolved when B-1 is fixed |

---

## Quick Wins (Can Ship This Week)

1. **Add `grantAllPermissions` flag to `Role`** — a 1-line migration + remove the string matching. (B-2)
2. **Remove `permissions` from JWT claims** — less token bloat, cleaner auth contract. (B-6)
3. **Switch `@CacheEvict` to key-based eviction** — one-line change, prevents thundering herd. (B-3)
4. **Create `@EnforceTenant` annotation** — ~30 lines of AOP, removes manual calls everywhere. (B-4)
5. **Add the `<Can>` component** — ~20 lines, unblocks all UI permission work. (F-2 partial)
6. **Add `generate:permissions` script** — eliminates type drift permanently. (F-3)
