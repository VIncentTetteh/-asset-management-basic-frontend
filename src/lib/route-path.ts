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

/** True when `pathname` matches one of `routes`, ignoring any trailing slash on either side. */
export function matchesRoute(pathname: string | null | undefined, routes: string[]): boolean {
    const target = normalisePath(pathname);
    return routes.some((route) => normalisePath(route) === target);
}
