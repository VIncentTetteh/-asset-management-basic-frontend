import { test, expect, type Page } from "@playwright/test";

/**
 * The failure and recovery path, against the real static export.
 *
 * Runs unauthenticated so it works in the fast CI suite (see
 * playwright.config.ts): everything here is about the shell's behaviour when
 * something breaks, which needs no backend.
 *
 * The behaviour under test is the one that produced the reported bug. A deploy
 * replaced the hashed chunks a long-lived tab still referenced; the tab asked
 * for a file that had gone, and the whole route died on a screen that said
 * nothing. The app now reloads itself once — and, crucially, exactly once.
 */

const CHUNK_RELOAD_KEY = "assetiq:chunk-reload-at";

/** Counts full document loads, which is how a reload is observed from outside. */
function countLoads(page: Page): () => number {
    let loads = 0;
    page.on("load", () => { loads += 1; });
    return () => loads;
}

/**
 * Throws the failure a missing chunk actually produces: a rejected dynamic
 * import, unhandled, which is what the router does when it fetches a route's
 * code. Going through a real `unhandledrejection` means the production
 * listener is what responds, not a test double.
 */
async function simulateStaleChunk(page: Page): Promise<void> {
    await page.evaluate(() => {
        const error = new Error("Loading chunk 4821 failed.");
        error.name = "ChunkLoadError";
        void Promise.reject(error);
    });
}

test.describe("stale-chunk recovery", () => {
    test("reloads once and never loops", async ({ page }) => {
        await page.goto("/login");
        await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();

        const loads = countLoads(page);
        expect(
            await page.evaluate((key) => sessionStorage.getItem(key), CHUNK_RELOAD_KEY),
            "no recovery should have been attempted yet",
        ).toBeNull();

        await simulateStaleChunk(page);

        // One reload, and the page comes back working.
        await expect.poll(loads, { timeout: 10_000 }).toBe(1);
        await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
        expect(
            await page.evaluate((key) => sessionStorage.getItem(key), CHUNK_RELOAD_KEY),
            "the attempt must be recorded, or the guard cannot hold",
        ).not.toBeNull();

        // The chunk is still missing and the failure happens again. This is
        // where a naive "reload on chunk error" spins forever. It must not
        // reload again, and the user must be left on a usable page.
        await simulateStaleChunk(page);
        await simulateStaleChunk(page);
        await page.waitForTimeout(2_000);

        expect(loads(), "a second reload would be the start of a loop").toBe(1);
        await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
    });

    test("an ordinary bug is not mistaken for a stale chunk", async ({ page }) => {
        await page.goto("/login");
        const loads = countLoads(page);

        await page.evaluate(() => {
            void Promise.reject(new TypeError("Cannot read properties of undefined (reading 'id')"));
        });
        await page.waitForTimeout(1_500);

        // Reloading would hide the bug and lose whatever the user had typed.
        expect(loads()).toBe(0);
        await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
    });
});

/**
 * A path no object and no route matches.
 *
 * What comes back depends on what serves the export, and the difference is a
 * deliberate trade, not an oversight:
 *
 * - A plain static origin that resolves error documents — the local suite's
 *   `npx serve out`, and most static hosts — answers **404** with the export's
 *   own `404.html`.
 * - **CloudFront in front of S3 answers 403** with S3's AccessDenied body. It
 *   could be made to serve `/404.html` instead, but `CustomErrorResponses` are
 *   configured per *distribution*, not per behaviour, and the same distribution
 *   also fronts `/api/*`. Mapping S3's 403-for-a-missing-object onto `/404.html`
 *   therefore rewrote **every API 403 into a 404**: an unauthenticated
 *   `GET /api/v1/assets` reported "not found" instead of "forbidden", and login
 *   failures became 404s. Corrupting the API's status codes to prettify a
 *   missing static page is the wrong trade and breaks any client that branches
 *   on 401/403, so the mapping was removed on purpose.
 *
 * Read the comment above `ViewerCertificate` in `infra/aws/compute-cdn.yaml`
 * before "fixing" this back. Serving the friendly document for the static
 * behaviour only would need behaviour-scoped origin-response handling, i.e.
 * Lambda@Edge.
 *
 * What must hold in both: an unknown path is reported as an error and never as
 * a page, and a path the app itself serves never lands on a blank screen.
 */
test.describe("a page that does not exist", () => {
    test("is reported as an error, never as a page", async ({ page }) => {
        const response = await page.goto("/no-such-page-anywhere");
        const status = response?.status();

        expect(status, "an unknown path answered 200 would be a page that is not there").not.toBe(200);
        expect([403, 404], `unexpected status ${status} for an unknown static path`).toContain(status);

        if (status === 404) {
            // This origin resolves error documents, so the body is the export's
            // own 404.html rather than the framework's bare default.
            await expect(page).toHaveTitle(/AssetIQ/);
        }
    });

    test("never leaves the visitor on a blank screen for a path the app serves", async ({ page }) => {
        // `/404` is the app's own not-found document — a real route in the
        // export, and the one an origin with error-document resolution hands
        // back. This is the guarantee the CDN trade above must not cost: once
        // the shell has the document, the visitor always lands somewhere with
        // something to do.
        await page.goto("/404");

        // Signed out, the shell sends any non-public path to sign-in rather than
        // showing a 404 for a page it cannot know about. Either way there is a
        // way forward.
        await page.waitForLoadState("networkidle").catch(() => undefined);
        await expect(page.locator("body")).not.toBeEmpty();
        await expect(
            page.getByRole("button", { name: /Sign in/i })
                .or(page.getByRole("heading", { name: /couldn't find that page/i })),
        ).toBeVisible({ timeout: 15_000 });
    });
});

test.describe("failures are announced, not swallowed", () => {
    test("a rejected sign-in shows a message that stays long enough to read", async ({ page }) => {
        // The API is not running in this suite; the request fails outright,
        // which is the offline/API-down case. It must produce a visible
        // message rather than a button that appears to do nothing.
        await page.route("**/api/v1/auth/login", (route) => route.abort("failed"));
        await page.goto("/login");

        await page.getByLabel("Email").fill("someone@example.com");
        await page.getByLabel(/password/i).first().fill("whatever-123");
        await page.getByRole("button", { name: /Sign in/i }).click();

        await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 15_000 });
        // And the form is still there to try again with.
        await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
    });
});
