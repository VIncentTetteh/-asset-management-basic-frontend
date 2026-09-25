/**
 * Normalises a pathname for comparison against a route list.
 *
 * `next.config.ts` sets `trailingSlash: true`, which the static export needs so every
 * route emits `<route>/index.html` and maps cleanly onto an S3 origin. The consequence
 * is that `usePathname()` returns `/login/` rather than `/login`, and any route list
 * compared with exact equality silently stops matching.
 *
 * That is not a hypothetical: it took the whole app down. `AuthContext`,
 * `PermissionContext` and `AppLayoutClient` each test
 * `publicPaths.includes(pathname)`. With the trailing slash present nothing matched, so
 * every page — including the login page — was treated as private. The auth provider
 * requested `/api/v1/auth/profile`, got a 403 because nobody was logged in, and the
 * layout rendered the authenticated shell, which renders nothing without a user. The
 * result was a blank page with no JavaScript error to explain it.
 *
 * Comparing normalised paths means route matching no longer depends on a build setting
 * that lives in a different file. `/` is preserved rather than collapsing to an empty
 * string.
 */
export function normalisePath(pathname: string | null | undefined): string {
    if (!pathname) return "/";
    const trimmed = pathname.replace(/\/+$/, "");
    return trimmed === "" ? "/" : trimmed;
}

/**
 * Every route that renders without a session.
 *
 * One list, because there were three — in `AuthContext`, `PermissionContext`
 * and `AppLayoutClient` — and they had already drifted: two knew about
 * `/login/sso-callback` and the third did not. A page missing from any one of
 * them gets the authenticated shell's treatment (a profile fetch, a permission
 * fetch, and a redirect to login), which for a public page is wrong in three
 * different ways.
 *
 * `/accept-invite` belongs here for the sharpest version of that reason: the
 * visitor has no account yet, which is the entire point of the page.
 *
 * The marketing and legal pages (`/contact`, `/support`, `/privacy`, `/terms`)
 * carry no account data. `/privacy` and `/terms` in particular are linked from
 * the mobile app for store review, so a signed-out reviewer must reach them.
 */
export const PUBLIC_PATHS = [
    "/",
    "/login",
    "/login/sso-callback",
    "/register",
    "/register-tenant",
    "/forgot-password",
    "/reset-password",
    "/accept-invite",
    "/contact",
    "/support",
    "/privacy",
    "/terms",
] as const;

/** True when `pathname` matches one of `routes`, ignoring any trailing slash on either side. */
export function matchesRoute(pathname: string | null | undefined, routes: string[]): boolean {
    const target = normalisePath(pathname);
    return routes.some((route) => normalisePath(route) === target);
}
