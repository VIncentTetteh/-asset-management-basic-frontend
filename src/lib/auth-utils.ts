/**
 * F-4: Auth utility functions.
 *
 * Pure, framework-agnostic helpers shared across the application.  They accept
 * a plain Set or array of permission strings so they work with the AuthContext
 * permissions Set as well as raw API payloads.
 *
 * IMPORTANT: Keep this file in sync with
 *   Enterprise-Asset-manager-desktop-app/shared/auth-utils.ts
 */

import type { Permission } from "@/types/permissions";

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Returns true if {@link userPermissions} contains {@link required}.
 *
 * @example
 * hasPermission(permissions, "VIEW_ASSETS")
 */
export function hasPermission(
  userPermissions: Set<string> | string[],
  required: Permission | string
): boolean {
  if (userPermissions instanceof Set) {
    return userPermissions.has(required);
  }
  return userPermissions.includes(required);
}

/**
 * Returns true if the user holds **at least one** of the given permissions.
 *
 * @example
 * hasAnyPermission(permissions, "EDIT_ASSET", "CREATE_ASSET")
 */
export function hasAnyPermission(
  userPermissions: Set<string> | string[],
  ...required: (Permission | string)[]
): boolean {
  if (userPermissions instanceof Set) {
    return required.some((p) => userPermissions.has(p));
  }
  return required.some((p) => userPermissions.includes(p));
}

/**
 * Returns true only when the user holds **all** of the given permissions.
 *
 * @example
 * hasAllPermissions(permissions, "VIEW_REPORTS", "EXPORT_REPORTS")
 */
export function hasAllPermissions(
  userPermissions: Set<string> | string[],
  ...required: (Permission | string)[]
): boolean {
  if (userPermissions instanceof Set) {
    return required.every((p) => userPermissions.has(p));
  }
  return required.every((p) => userPermissions.includes(p));
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

/**
 * Decodes the payload of a JWT (without signature verification — verification
 * is the backend's responsibility).  Returns null if the token is malformed.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const raw = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = raw.padEnd(raw.length + ((4 - (raw.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/**
 * Normalises a raw JWT role claim to the "ROLE_XXX" format expected by
 * the permission cache (e.g. "ADMIN" → "ROLE_ADMIN").
 */
export function normalizeRoleClaim(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw.startsWith("ROLE_") ? raw : `ROLE_${raw}`;
}

/**
 * Converts a permissions payload from the API into a {@link Set}.
 * Handles the case where the API returns either an array or a comma-separated
 * string (legacy — should no longer occur after Phase 2 B-1).
 */
export function parsePermissions(raw: unknown): Set<string> {
  if (!raw) return new Set();
  if (Array.isArray(raw)) {
    return new Set(raw.filter((p) => typeof p === "string" && p.length > 0));
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return new Set(
      raw
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    );
  }
  return new Set();
}
